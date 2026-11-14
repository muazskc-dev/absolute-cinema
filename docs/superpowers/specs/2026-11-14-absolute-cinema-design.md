# ABSOLUTE-CINEMA — design

Date: 2026-11-14
Status: approved brief, design complete.

## 1. Intent

Two people, on two different Windows computers, press play at the same moment
and watch the same film. They talk, they type, they pause for tea, and neither
of them has to upload a 40 GB file to a stranger's server.

The product is a **private cinema**, not a streaming platform. The server is a
timekeeper and a mailbox. The film stays where it belongs.

The moment that defines the product: one person opens a local 4K MKV, the other
opens the same file from their own disk, and both see the same frame while they
hear each other over voice. If either presses pause, both pause. If the network
hiccups, they come back to the same place without a manual re-sync.

## 2. Who it serves

Exactly two people per room. A couple, two friends, two family members. They
already own the media or have a legitimate source URL. They are not
broadcasting, not building an audience, and not inviting a third person.

This constraint is a feature: it removes discovery, moderation, scaling,
recommendation and monetization from the design.

## 3. Goals

1. One shared, server-authoritative playback timeline across two independent
   local players.
2. Local-first media: local files and direct URLs play on the client, never
   through the VPS.
3. Sync quality measured, not asserted: p95 drift ≤ 150 ms under suitable
   network conditions, with graceful recovery from jitter, loss, buffering and
   reconnection.
4. Smooth playback of 4K and, where the GPU and codec permit, 8K, without
   transcoding.
5. A calm, minimal AMOLED-black interface that does not compete with the film.
6. Chat and optional voice that never interfere with playback.
7. Privacy by default: no video upload, no local path sharing, microphone only
   on explicit request.
8. A maintainable codebase with a small dependency surface and a repeatable
   deployment.

## 4. Non-goals

- More than two participants per room.
- Public rooms, discovery, followers, recommendations.
- A media library or cloud DVR.
- Server-side transcoding or video relay.
- DRM circumvention, paywall bypass, ad removal, or protected-stream
  extraction.
- Mobile, macOS, Linux clients in the first release (the architecture keeps
  ports possible; the product is Windows-first).
- End-to-end encryption. TLS/WSS is the MVP boundary; E2EE is a separate,
  explicitly scoped future feature.
- A web-only client. The media engine is native.

## 5. Anti-goals

These are failures even if the app technically runs:

- A room where one person is 2 seconds ahead and nobody notices until the
  dialogue is out of phase.
- A "sync" button that the user has to press repeatedly.
- Routing video through the VPS "just in case".
- A 500 MB Electron-style idle footprint and a fan that spins during a paused
  film.
- A UI that rerenders the whole tree ten times per second and makes the
  scrubber stutter.
- Collecting media URLs, file paths, or viewing history on the server.
- Shipping a bundled mpv without honoring GPL obligations.

## 6. Constraints

- Windows 10/11 x64 is the first-class desktop target.
- Tauri 2, Rust stable-msvc, React 19, TypeScript, Vite, Tailwind CSS 4,
  Motion.
- mpv 0.42+ as the external media engine for the MVP.
- Node.js 22+ / Fastify 5 / WebSocket / PostgreSQL 18 on the server.
- Caddy and coturn in Docker Compose on Ubuntu 24.04 LTS.
- A room has exactly two members.
- No Redis in the MVP.
- No media traffic through the server in ordinary operation.
- 4K/8K support is capability-dependent and must be reported honestly by the
  client.

## 7. Decisions made by the brief

The brief fixes the stack, the AMOLED direction, the two-person limit, the
server-authoritative timeline, the drift bands as *initial* values, the sprint
order, and the privacy posture. These are not reopened here.

## 8. Decisions made by the builder

These are calls the brief left open. Each is reversible, but each has a cost.

1. **mpv as a separate process first, libmpv embedding later.** Sprint 0 proves
   named-pipe IPC, playback control, position reporting and hardware decoding
   with the installed mpv binary. Embedding libmpv into a Tauri window is a
   separate spike because it changes the graphics-context and packaging story.
   The app must not claim embedded video until that spike passes.
2. **Opaque device tokens + short-lived WebSocket tickets, not JWT.** The
   server stores only SHA-256 hashes of long-lived device tokens. A REST call
   exchanges the device token for a 60-second, single-use WS ticket. This is
   simpler to revoke than a JWT and avoids signing-key rotation in the MVP. The
   `.env` example still carries `JWT_SECRET` in the brief; our implementation
   will not require it. This deviation is recorded in `docs/architecture.md`.
3. **Canonical media identity is a descriptor, not a file transfer.** For local
   files: file name, byte size, duration, and a sampled content fingerprint
   (first 4 MiB + last 4 MiB + size). Full SHA-256 is available as an option
   with progress, but is not the default because hashing a 40 GB file delays
   playback by minutes. The fingerprint detects mismatched files; it is not a
   cryptographic proof of identity.
4. **Timeline lives in memory, snapshots persist on mutation.** PostgreSQL
   stores rooms, members, chat and a debounced timeline snapshot for restart
   recovery. The read path is memory. No Redis.
5. **Both participants may control playback.** The last accepted intent wins
   and `controllerId` records who issued it. A host-only remote is a worse
   experience for two equals; room management (close, regenerate invite) stays
   with the host.
6. **The server never fetches media URLs.** All URL metadata inspection happens
   on the client that will play the URL. The server only stores the descriptor
   (redacted if it contains credentials). This removes the largest SSRF surface
   from the VPS. A URL-validation module still guards any future server-side
   fetch and the Tauri side rejects non-HTTP(S) schemes.
7. **YouTube is a phase-6 adapter, not an MVP promise.** WebView2 does not ship
   Widevine, and embedding third-party players has both technical and
   contractual limits. The MVP supports local files and direct HTTP/HLS/DASH
   sources. DRM services are explicitly unsupported.
8. **TURN relays audio only.** coturn exists for voice, not video. Its relay
   port range is sized for a handful of two-person calls.
9. **No auto-update in the first private build.** Code signing and the updater
   are Sprint 7 deliverables; shipping an unsigned auto-updater is worse than
   shipping a signed installer without one.

## 9. Success measures

| Measure | Target | How it is measured |
|---|---|---|
| Drift p95 | ≤ 150 ms | Client reports, CSV export, two-machine test |
| Control-to-motion p95 | ≤ 150 ms | Timestamped intent → first status reflecting it |
| UI frame rate | 60 fps during interaction | DevTools performance trace, Windows GPU view |
| Idle RAM (app, no video) | < 150 MB | `Get-Process` sampling |
| Idle CPU (paused) | < 1% average | 10-minute sample |
| 4K playback | No dropped frames on capable GPU | mpv `frame-drop-count`, `decoder-frame-drop-count` |
| 8K playback | Documented per machine, no universal claim | Hardware decode status + dropped-frame counters |
| Reconnect | Restores room + timeline without user action | Kill network, restore, compare state |
| Video through VPS | 0 bytes in normal operation | Interface counters / server logs |

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| mpv IPC lifecycle bugs (zombie processes, pipe races) | High | Single owner in Rust, explicit stop/kill, startup retry, integration tests |
| WebView2/mpv window integration | High | Separate-process MVP; embedding spike before promising in-window video |
| Clock estimation wrong after sleep/resume | Medium | Monotonic clock, reset probing on resume/reconnect, confidence gating |
| Drift correction audible (pitch/seek) | Medium | Rate nudge ±5%, dead band, cooldowns, hard seek only when sustained |
| Local file mismatch | Medium | Descriptor handshake, explicit warning, optional full hash |
| URL playback failures (range, redirects, codecs) | Medium | Client-side probe, clear error codes, mpv fallback logging |
| 8K on integrated GPU | Medium | Report actual decode path; never promise universal 8K |
| GPL compliance for mpv distribution | Medium | Do not bundle in MVP; document distribution plan |
| Third-party site breakage | Low (phase 6) | Adapter isolation, feature flags, honest compatibility list |
| Single VPS failure | Medium | Room state snapshot; clients can finish locally; redeploy runbook |

## 11. What the builder may decide without asking

- File and module names inside the agreed structure.
- Exact React state library (Zustand is the default).
- Exact component primitives and motion durations within the design tokens.
- Test framework choices (Vitest, Rust `#[test]`, Playwright/tauri-driver).
- Logging format and internal error codes, as long as they are documented.
- Docker image tags, provided they are pinned and reproducible.

## 12. What requires the owner

- The production domain and VPS provider.
- Whether the project is open source, and under which license.
- Code-signing certificate purchase and identity details.
- Whether mpv will be bundled in the installer (GPL compliance decision).
- Any expansion beyond two participants or beyond Windows.
