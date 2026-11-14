# Security and privacy

Security is a design input, not a Sprint 7 checklist. This document covers the
MVP attack surface and the controls that must exist before the first networked
build.

## 1. Assets

| Asset | Sensitivity | Where it lives |
|---|---|---|
| Local media files | High | User disk only |
| Local file paths | Medium | Client memory; never server/logs |
| Device token | High | Windows Credential Manager |
| Invite token | Medium | URL/deep link; hashed server-side |
| Chat messages | Medium | Server DB while room exists |
| Voice audio | High | WebRTC P2P; TURN only if NAT fails |
| TURN secret | High | Server env; never client |
| Database | High | Private Docker network |
| Media URLs with tokens | High | Client memory; redacted in logs |

The server never receives video bytes, local file paths, microphone audio, or
raw invite/device tokens.

## 2. Threat model

| Threat | Vector | Control |
|---|---|---|
| Room hijacking | Guessable room id / leaked invite | 128-bit room ids, 256-bit invite tokens, hashed at rest, regenerate/expire |
| Unauthorized playback control | Forged WS client | WS ticket auth, membership check, revision checks |
| Spam / abuse | Chat or intent floods | Per-user/per-IP rate limits, socket close on repeat |
| XSS via chat | HTML/emoji payloads | Render as text nodes; no `dangerouslySetInnerHTML`; strip control chars |
| Session theft | Token in localStorage/logs | OS credential store; redaction; short-lived WS tickets |
| SSRF | Server-side URL probing | No server media fetch; strict validator if ever added |
| Local network probing | Malicious media URL | Client-side probe blocks private ranges for remote URLs; user-initiated local URLs allowed |
| Malicious media | Decoder exploit | Keep mpv/FFmpeg updated; no shell interpolation; separate process |
| Command injection | File path/URL in mpv args | Spawn with argument array, never a shell; sanitize `--` prefixed paths |
| TURN abuse | Open relay | `use-auth-secret` + time-limited credentials; denied private peer ranges |
| Secret leakage | Logs, git | Env only, redaction, `.gitignore`, gitleaks in CI |
| Dependency compromise | npm/crates | Lockfiles, `pnpm audit`, `cargo audit`, Dependabot/Renovate |
| Update hijack | Unsigned installer | Signed builds + signed updater manifest (Sprint 7) |
| Privacy violation | Telemetry default-on | No analytics in MVP; opt-in diagnostics only |

## 3. Desktop hardening

### Tauri capabilities

Only the commands the UI needs are exposed. No blanket filesystem or shell
access.

- `dialog:allow-open` for media/subtitle selection.
- Custom commands: `mpv_start`, `mpv_stop`, `mpv_open`, `mpv_play`,
  `mpv_pause`, `mpv_seek`, `mpv_set_speed`, `mpv_get_status`,
  `media_probe`, `media_fingerprint`, `settings_*`, `secret_*`.
- No `shell:allow-execute`; mpv is spawned by Rust with a fixed argument array.
- No remote URLs loaded in the main WebView. External links open in the system
  browser after an allowlist check.
- CSP: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline';
  connect-src 'self' https://api.<domain> wss://api.<domain>; media-src 'none';
  frame-src 'none'` for the MVP. The YouTube adapter (phase 6) gets a separate,
  narrowly scoped window/CSP, not a relaxation of the main window.

### mpv invocation

- Resolve the mpv executable from a configured absolute path or a known
  install location; verify it exists and is a file.
- Use `std::process::Command`/Tokio with an argument vector. Never build a
  command string.
- Reject paths starting with `--` by inserting `--` or using `loadfile` with the
  path as a separate argument.
- Disable mpv config files (`--no-config`) so a malicious local config cannot
  enable scripts or network listeners.
- Do not enable mpv's Lua scripting, `--input-ipc-server` beyond the private
  per-process pipe, or `--http-server`.
- Named pipe name includes PID and a random nonce; default Windows ACLs apply
  to the current user.

### Token storage

Use Windows Credential Manager through the `keyring` crate. Never write tokens
to `localStorage`, `sessionStorage`, a JSON settings file, or logs. If the
credential store is unavailable, keep the token in memory for the session and
warn the user; do not silently fall back to plaintext.

### Local file handling

- Never send absolute paths to the server, chat, crash reports, or analytics.
- The media descriptor contains a display name only; strip directory segments.
- Subtitle files are loaded locally; do not upload them.
- Hashing is local and cancellable; it must not block the UI thread.

## 4. URL validation

Two different trust boundaries:

1. **Client-side playback.** The user may intentionally open
   `http://192.168.1.20/movie.mkv` from their NAS. The client allows private
   addresses because the user chose them, but it still rejects non-HTTP(S)
   schemes and never passes URLs through a shell.
2. **Server-side fetch.** The MVP server does not fetch media URLs. If a future
   feature (e.g., remote metadata) does, it must use this validator:

```ts
// Reject unless every resolved address is public.
const blocked = new net.BlockList();
blocked.addSubnet("0.0.0.0", 8, "ipv4");
blocked.addSubnet("10.0.0.0", 8, "ipv4");
blocked.addSubnet("100.64.0.0", 10, "ipv4");
blocked.addSubnet("127.0.0.0", 8, "ipv4");
blocked.addSubnet("169.254.0.0", 16, "ipv4");
blocked.addSubnet("172.16.0.0", 12, "ipv4");
blocked.addSubnet("192.0.0.0", 24, "ipv4");
blocked.addSubnet("192.168.0.0", 16, "ipv4");
blocked.addSubnet("198.18.0.0", 15, "ipv4");
blocked.addSubnet("224.0.0.0", 4, "ipv4");
blocked.addAddress("::1", "ipv6");
blocked.addSubnet("fc00::", 7, "ipv6");
blocked.addSubnet("fe80::", 10, "ipv6");
blocked.addSubnet("ff00::", 8, "ipv6");
```

Rules:

- Only `http:` and `https:`; no userinfo (`user:pass@`).
- Resolve DNS and validate **all** A/AAAA records, then connect to the validated
  IP (pin it) to prevent DNS rebinding.
- Re-validate on every redirect; max 5 redirects; no downgrade from HTTPS.
- Timeout 5 s; max 16 KiB of response headers/body for probes.
- Do not follow redirects to `file:`, `gopher:`, or link-local metadata
  endpoints (cloud metadata `169.254.169.254`).
- Log the hostname, never the query string.

## 5. API and WebSocket

- TLS 1.2+ only; HSTS at Caddy; HTTP redirects to HTTPS.
- CORS: no browser origin needs access in the MVP. Allow only the Tauri origin
  in development; production native requests do not need CORS. Do not use `*`.
- Security headers via `@fastify/helmet`: `nosniff`, `frame-ancestors 'none'`,
  `referrer-policy no-referrer`, `permissions-policy` denying camera/mic by
  default.
- Body limit 64 KiB for REST; WS frame limit 64 KiB; chat 2,000 chars.
- Auth: opaque device token hashed with SHA-256; WS ticket single-use, 60 s.
- Authorization: every room event re-checks membership; host-only room actions
  check `host_id`.
- Replay: WS tickets expire and are consumed; intents are idempotent by
  `requestId` for 30 s.
- Rate limits at the IP and user level; reverse proxy trusts only Caddy.
- Do not reflect internal errors; log with a request id.

### Password hashing

The MVP has no passwords. If account passwords are added, use Argon2id with
OWASP-recommended parameters and per-user salts. Never SHA-256 a password.

## 6. Voice privacy

- Voice is off by default; the microphone is opened only after an explicit
  toggle and OS permission.
- Show a persistent recording/mic indicator while the track is live.
- Mute disables the sender track; disabling voice stops all tracks, closes the
  peer connection, and releases the device.
- Do not record, buffer, or send voice to the server. Signaling carries SDP/ICE
  only; do not log it.
- TURN credentials are time-limited (1 h) and scoped to a username; the shared
  secret never leaves the server.
- coturn: `no-cli`, `no-multicast-peers`, `denied-peer-ip` for private ranges,
  `fingerprint`, `use-auth-secret`, `stale-nonce`.

## 7. Database and server

- PostgreSQL is not published to the host; only the API network can reach it.
- Least-privilege DB user: no superuser, no DDL at runtime (migrations use a
  separate role or run before the app starts).
- Parameterized queries only; no string-built SQL.
- Secrets from env/secret files with 0600 permissions; no secrets in images.
- API container runs as a non-root user, read-only root filesystem where
  possible, `no-new-privileges`, dropped capabilities.
- Logs: structured JSON, request id, user id (not token), redacted URL query
  strings and headers (`authorization`, `cookie`).
- Backups encrypted at rest; restore tested quarterly.
- Cleanup job removes expired rooms, tickets and chat.

## 8. Dependency and supply chain

- Commit `pnpm-lock.yaml` and `Cargo.lock`.
- CI: `pnpm audit --prod`, `cargo audit`, license check, secret scan (gitleaks),
  `cargo deny` for advisories/licenses.
- Pin Docker images by digest for production.
- Review new dependencies for install scripts; pnpm `onlyBuiltDependencies`
  allowlist.
- Tauri updater: signed manifest, HTTPS only, rollback protection; not enabled
  until Sprint 7.

## 9. Privacy posture

Collected by the server:

- Display name, room name, membership timestamps.
- Chat messages for the room lifetime and 24 h retention.
- Media descriptor metadata (name, size, duration, codecs, fingerprint).
- Operational logs without media URLs or file paths.

Not collected:

- Video/audio bytes, local absolute paths, viewing history beyond the room,
  contact lists, analytics identifiers, microphone audio.

User controls:

- Leave room / close room deletes membership immediately; chat and room are
  deleted after retention.
- "Clear local data" removes tokens, settings and cached descriptors.
- Diagnostics are opt-in and never include media paths or URLs.

## 10. Incident checklist

1. Revoke TURN secret and rotate `.env`; restart coturn and API.
2. Invalidate device tokens / WS tickets in the DB.
3. Preserve logs (redacted), then patch and redeploy.
4. If mpv/FFmpeg vulnerability: ship a new mpv dependency or update bundled
   runtime; advise users until then.
5. If database exposure is suspected: rotate DB credentials, restore from a
   known-good backup, notify affected users.
6. Write a short postmortem with timeline, impact, root cause and prevention.
