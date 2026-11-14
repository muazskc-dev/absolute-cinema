# ABSOLUTE-CINEMA — implementation plan

Date: 2026-11-14
Owner: project owner
Status: baseline approved; Sprint 0 in progress.

This plan is written to be executed by one senior engineer (with AI assistance)
without needing to rediscover the architecture. It states what exists today,
what is decided, what is measured, and what is deliberately excluded.

## 1. Executive summary

ABSOLUTE-CINEMA is a Windows-first Tauri 2 desktop application for exactly two
people. Each person plays the same local file or direct source on their own PC;
a Fastify/WebSocket server owns a derived playback timeline and coordinates
play, pause, seek, rate, buffering, chat and WebRTC voice signaling. No video
bytes traverse the VPS.

The plan proceeds in the order the brief requires:

1. Validate the media engine (Sprint 0).
2. Establish the AMOLED UI (Sprint 1).
3. Build the two-person room backend (Sprint 2).
4. Implement the authoritative sync engine (Sprint 3).
5. Broaden media sources (Sprint 4).
6. Add chat and voice (Sprint 5).
7. Add guarded website adapters (Sprint 6).
8. Profile, secure and release (Sprint 7).

The highest technical risks are mpv process/window integration and clock/drift
behavior on real networks. Both are measured before the product UI depends on
them. Claims such as "4K/8K smooth" and "p95 drift 150 ms" are acceptance tests,
not marketing copy.

## 2. What is already true (2026-11-14)

- Project directory created; pnpm workspace and Tauri 2 React/TS scaffold exist.
- Rust 1.100.0 stable-msvc, Node 26.13.0, pnpm 12.18.0, mpv 0.42.0 installed.
- Visual Studio Build Tools + Windows SDK installation started (required for
  linking Tauri on Windows).
- Design, architecture, protocol, security and deployment documents written.
- Open-source review completed with license evidence (see `docs/repo-review.md`).
- Infra blueprint written (`infra/`), pending the Sprint 2 API image.

Not yet true: mpv IPC is not implemented, the backend does not exist, no
synchronization has been measured, and no installer has been built. Do not
describe those as done.

## 3. Architecture validation

### 3.1 What we keep from the brief

Tauri 2, Rust native layer, React/TypeScript, Tailwind, Motion, mpv, Fastify,
WebSocket, PostgreSQL, coturn, Caddy, Docker Compose, server-authoritative
timeline, two-person rooms, local-first media, AMOLED black.

### 3.2 What we change, and why

| Change | Reason | Cost |
|---|---|---|
| Opaque device tokens + 60 s WS tickets instead of JWT | Revocable, no signing-key rotation, tokens hashed at rest | Slightly more DB writes for tickets |
| Client-side media probing; server never fetches media URLs | Removes SSRF from the VPS and keeps URLs private | Client must do HEAD/range checks |
| Debounced timeline snapshots in PostgreSQL | Survive server restart without Redis | Small write load on mutations only |
| Sampled fingerprint default, full SHA-256 opt-in | Hashing 40 GB delays playback | Weaker than a full hash; mismatch warning still works |
| mpv external process first, libmpv embedding as a spike | Isolates crash/GPU risk and packaging | Separate window until embedding passes |
| Both members can control | Two equals watching a film | Last-write-wins; no host gate on playback |
| YouTube/DRM out of MVP | WebView2 lacks Widevine; third-party integration is conditional | Fewer sources at launch; honest compatibility |

These are recorded in `docs/architecture.md` §11 and the design doc §8.

### 3.3 Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Electron + HTML5 video | Cannot reliably open local MKV/ASS/multi-audio; 100 MB+ idle overhead; Chromium codec limits |
| Browser-only app | No local file access with mpv-class codecs; no native process control |
| WebRTC data channels for sync | Unnecessary; WebSocket is ordered, reliable and proxy-friendly at this scale |
| Redis / message broker | Single server, two users per room; adds ops without a measured need |
| Rust backend | Lower tail jitter, but a second runtime and slower iteration; Node is adequate for a tiny hot path. Revisit only with latency evidence |
| Server-side transcoding | Violates local-first and cost goals; turns the VPS into a media server |
| Bundling mpv immediately | GPLv2+ distribution obligations; MVP can detect a user-installed mpv |

### 3.4 Foundation reuse decision

- **WatchParty (MIT):** study room/controller concepts; no structural reuse.
- **playercn (no license):** study derived timeline, clock estimator, correction
  bands; **no code**.
- **SyncPlay (Apache-2.0):** study mpv IPC lifecycle and readiness semantics;
  no Python reuse.
- Nothing third-party is copied in Sprint 0. See `docs/repo-review.md`.

## 4. Repository structure (target)

```text
absolute-cinema/
├── apps/desktop/
│   ├── src/                    React UI
│   │   ├── app/                routes/screens
│   │   ├── components/         design system + shared
│   │   ├── features/           home, rooms, player, chat, voice, settings
│   │   ├── hooks/
│   │   ├── services/           tauri bridge, ws client, clock
│   │   ├── stores/             zustand stores
│   │   └── styles/
│   └── src-tauri/
│       └── src/
│           ├── commands/       typed Tauri commands
│           ├── media/          mpv process + IPC + probing
│           ├── sync/           future native timing helpers
│           ├── security/       token storage, URL validation
│           └── main.rs / lib.rs
├── packages/protocol/          Zod schemas, timeline math, shared types
├── services/api/               Fastify API + WS coordinator
├── infra/                      compose, Caddy, coturn
└── docs/
```

Rules:

- `packages/protocol` has no I/O and no runtime dependencies beyond Zod.
- `services/api` imports the protocol package; it does not redefine schemas.
- Rust never imports TypeScript. The wire format is validated on both sides.
- UI components never call mpv directly; they call typed commands.

## 5. Sprint 0 — media proof of concept (current)

**Goal:** prove that mpv can be spawned, controlled and measured from Rust
before building the product around it.

### Tasks

1. Finish Tauri scaffold and workspace (done: package rename, Tailwind, lint).
2. Implement `MpvManager`:
   - spawn mpv with the launch contract in `docs/architecture.md` §3;
   - named-pipe JSON IPC with request IDs, timeouts and retry;
   - writer/reader tasks, event stream, child lifecycle;
   - graceful quit + kill fallback; no orphan processes.
3. Commands: `mpv_start`, `mpv_stop`, `mpv_open`, `mpv_play`, `mpv_pause`,
   `mpv_seek`, `mpv_set_speed`, `mpv_get_status`, `mpv_set_property`.
4. Status monitor: 4 Hz snapshot with `time-pos`, `duration`, `pause`, `speed`,
   `paused-for-cache`, `eof-reached`, `hwdec-current`, `video-params`,
   `audio-params`, `track-list`, frame-drop counters.
5. Media Lab screen:
   - start/stop engine;
   - open local file via dialog;
   - open direct URL;
   - play/pause, ±10 s seek, scrubber, rate buttons;
   - status panel with decoder evidence and event log.
6. Test media:
   - small H.264 MP4, MKV with multiple audio/subtitle tracks;
   - a 4K sample;
   - an 8K sample if available and disk/network permit.
7. Evidence report: `artifacts/sprint0-report.md` with machine specs, mpv
   version, decoder path, resolution, dropped frames and observed limitations.

### Acceptance criteria

- [ ] App launches on Windows and spawns exactly one mpv process.
- [ ] Local MP4 and MKV open and play.
- [ ] Play, pause, seek, rate change work from the UI.
- [ ] Position and duration update at 4 Hz with <100 ms IPC overhead.
- [ ] `hwdec-current` is reported and is not guessed.
- [ ] A 4K file plays; dropped-frame counters are recorded.
- [ ] An 8K attempt is recorded honestly (works / software / not smooth).
- [ ] Closing the app leaves no `mpv.exe` behind.
- [ ] `cargo test`, `cargo clippy -- -D warnings`, `pnpm typecheck` pass.

### Tests

| Test | Method |
|---|---|
| IPC framing | Rust unit tests for JSON line parsing and request-ID routing |
| Spawn/connect race | Start/stop 20 times; no leaked pipe/process |
| Playback control | Load sample, assert position advances; pause freezes; seek jumps |
| Decoder evidence | `hwdec-current` + `video-params` captured from a 4K file |
| Process cleanup | `Get-Process mpv` after app exit |
| URL load | Small public MP4 over HTTPS; verify position advances |

### Risks

- Named-pipe connect race → retry loop with deadline.
- mpv window steals focus / closes app → explicit lifecycle, `--keep-open`.
- Antivirus delays process spawn → user-visible retry, no silent failure.
- 8K decode on the build machine (Radeon 5700U, 2 GB shared) may be software
  or dropped frames. That is a documented device limit, not a bug to hide.

## 6. Sprint 1 — UI and design system

**Goal:** the final visual identity before the product grows.

### Tasks

- Tailwind 4 tokens:
  - `--bg: #000000`, `--surface: #0A0A0B`, `--surface-2: #121214`,
    `--border: #232327`, `--text: #F5F5F7`, `--muted: #9A9AA3`,
    `--accent: #E11D2E`, `--accent-soft: #3A0B10`.
  - type scale, spacing, radii, focus ring, motion durations.
- Fonts: bundle a variable sans (Inter) and a display serif (Instrument Serif)
  locally; no network font fetch at runtime.
- Screens: Home, Create Room, Join Room, Settings, Room shell (player area,
  chat panel, member strip).
- Motion: 150–250 ms ease-out; page fade/slide; no animation on the video
  surface; `prefers-reduced-motion` respected.
- Accessibility: focus-visible, contrast ≥ 4.5:1 for body text, keyboard
  shortcuts, 44 px targets.
- Empty/loading/error states; no lorem ipsum.

### Acceptance

- [ ] Usable at 1280×800 and 1920×1080, 100% and 125% scaling.
- [ ] AMOLED black is true `#000` on the app background.
- [ ] No layout shift when the status panel updates.
- [ ] Keyboard-only navigation works through the main flows.
- [ ] Screenshots committed under `docs/screens/` at both sizes.
- [ ] No video integration claimed yet.

## 7. Sprint 2 — backend and rooms

**Goal:** two different computers join the same private room.

### Tasks

- `services/api` Fastify skeleton with config validation, structured logging,
  error handler, `/v1/health`, `/v1/config`.
- PostgreSQL schema + migration runner (see `docs/protocol.md` §10).
- Device-token auth, WS ticket issuance, hashed storage.
- Room create/join/get/close/leave; 256-bit invite token; 24 h TTL; two-member
  trigger; host role.
- WebSocket hub: authenticate, subscribe/resume, presence, snapshot, heartbeat.
- Deep link handling in Tauri (`absolute-cinema://join?...`) with token
  redaction in logs.
- Docker Compose stack runnable: postgres, migrate, api, caddy; coturn optional
  locally.
- Integration tests with a real PostgreSQL (Docker) and two WS clients.

### Acceptance

- [ ] Two machines on the same LAN join via invite link and see each other.
- [ ] A third join returns `room_full`.
- [ ] Invalid/expired invite returns `invalid_invite`.
- [ ] `GET /v1/health` reports DB status.
- [ ] WS ticket is single-use and expires in 60 s.
- [ ] Room TTL cleanup removes expired rooms and chat.
- [ ] No PostgreSQL or API port is publicly exposed.

## 8. Sprint 3 — synchronization engine

**Goal:** one measured shared timeline, not a broadcast of commands.

### Tasks

- `packages/protocol`: Zod schemas for every REST/WS message; timeline math;
  unit tests for boundaries, clamping, revision ordering, rate validation.
- Server `timeline` module: pure functions, no I/O; revision per mutation;
  ready gating; idempotent intents.
- Client clock estimator: monotonic clock, burst probes, p20 RTT filter,
  median offset, confidence.
- Sync controller:
  - apply server state with lead time;
  - drift measurement at 1 Hz;
  - dead band 80 ms, rate nudge ±5% up to 3 s, sustained >250 ms seek;
  - cooldowns after user actions; suppress while buffering or clock-unconfident.
- Buffering protocol and `Keep us in sync` toggle.
- Reconnection: snapshot resume, stale revision handling, media mismatch pause.
- Diagnostics: CSV export `timestamp, driftMs, rttMs, offsetMs, confidence,
  buffering, position`.
- Integration harness: two WS clients + two fake players driven by the same
  timeline; fault injection (latency 50–200 ms, loss, jitter, disconnect).

### Acceptance

- [ ] Play/pause/seek/rate propagate to both clients.
- [ ] p95 drift ≤ 150 ms on LAN over a 30-minute run.
- [ ] p95 drift ≤ 150 ms with 50–200 ms injected latency and 1% loss.
- [ ] Reconnect restores the same position without user action.
- [ ] Buffering pauses both when "Keep us in sync" is on; resumes correctly.
- [ ] Stale intents are rejected and resynced.
- [ ] No seek storm over a 2-hour soak.
- [ ] Server restart restores the last snapshot.

## 9. Sprint 4 — media sources

**Goal:** both people can open compatible content and stay verified.

### Tasks

- Local file descriptor: name, size, duration, tracks, sampled fingerprint;
  optional full SHA-256 with progress/cancel.
- Direct URL: HEAD/range probe, MIME/extension checks, redirects, timeouts,
  content-length, range support, error taxonomy.
- HLS/DASH via mpv/FFmpeg; playlist handling; live-stream behavior (no duration,
  no seek; explicit UI).
- Subtitle loading (SRT/ASS/SSA) and audio-track selection; per-user, not synced
  (subtitle timing is personal; document this).
- Hardware decoder selection UI (`auto-safe`, `d3d11va`, `d3d11va-copy`,
  software) with actual `hwdec-current` display.
- Media mismatch warning; "play anyway" explicit override.
- Codec/resolution test matrix and known-limitations doc.

### Acceptance

- [ ] A 4K MKV with multiple audio tracks opens on both clients.
- [ ] Both descriptors match; a mismatched file warns before playback.
- [ ] Direct HTTPS MP4 plays without downloading the whole file.
- [ ] HLS test stream plays (if the source permits).
- [ ] Subtitle and audio-track changes are local and do not desync.
- [ ] Range/redirect/403 errors show actionable messages.
- [ ] No full file is buffered in RAM.

## 10. Sprint 5 — chat and voice

**Goal:** communication that does not touch the video pipeline.

### Tasks

- Chat: send/echo, history pagination, typing, presence, reactions, Unicode
  emoji, rate limits, reconnect.
- Voice: WebRTC peer connection, signaling over WS, STUN/TURN credentials,
  mic consent, mute, device selection, connection quality, teardown.
- coturn deployment verification (UDP + TCP fallback).
- UI: chat panel isolated from player; voice bar with explicit states.
- Tests: two-client chat; voice loopback; TURN-forced call; mic denied; network
  drop during call.

### Acceptance

- [ ] Chat messages arrive in <200 ms on LAN and persist for history.
- [ ] Typing indicator expires; rate limits return a clear error.
- [ ] Voice is off by default; mic permission is requested only on enable.
- [ ] Mute stops sending audio; disable releases the device and closes PC.
- [ ] A call succeeds with TURN forced (UDP blocked) at acceptable quality.
- [ ] Voice CPU overhead <5% on the build machine; no effect on playback.

## 11. Sprint 6 — website adapters (gated)

**Goal:** supported, authorized websites only.

### Tasks

- `SiteAdapter` interface and registry with per-adapter capability flags.
- YouTube official IFrame player in a dedicated, sandboxed WebView window;
  verify Terms and embed behavior before shipping.
- One HTML5-compatible site adapter if technically and contractually permitted.
- Adapter health checks, disable flags, clear compatibility list.
- DRM assessment: document that Widevine/PlayReady services are unsupported;
  no circumvention code.

### Gate

If YouTube embedding cannot be made reliable and compliant in WebView2, ship
the adapter framework and a documented limitation instead of a fake feature.
Do not ship DRM circumvention, ad removal, or stream extraction.

### Acceptance

- [ ] Adapter interface is unit-tested with a fake adapter.
- [ ] YouTube (if enabled) play/pause/seek sync within the normal drift target.
- [ ] Unsupported URL shows a clear "not supported" state.
- [ ] Feature can be disabled server-side without a client update.

## 12. Sprint 7 — optimization and release

- Profile UI (60 fps), memory, CPU, GPU decode, 2-hour soak.
- Security review against `docs/security.md`; dependency audit; secret scan.
- Windows installer (MSI/NSIS), icon, versioning, clean-VM install test.
- Code signing; SmartScreen check; uninstall/upgrade test.
- Auto-update design (signed manifest) or explicit no-updater release note.
- Opt-in crash/diagnostic reporting with redaction.
- Final docs: user guide, known limitations, deployment runbook, backup drill.

### Acceptance

- [ ] No P0/P1 defects; P2 list reviewed.
- [ ] 2-hour playback + chat + voice soak with no leak or drift runaway.
- [ ] Installer works on a clean Windows 11 VM without dev tools.
- [ ] Uninstall removes app data or preserves it per documented policy.
- [ ] Signed binary verifies; update path tested or explicitly deferred.
- [ ] Performance report attached with measured numbers.

## 13. Initial backlog (11 tasks)

| # | Task | Depends on | Files | Acceptance | Complexity | Risk |
|---|---|---|---|---|---|---|
| 1 | Tauri 2 + React + TS project | — | `apps/desktop/**`, root workspace | App launches; typecheck passes | S | Low |
| 2 | AMOLED design system | 1 | `src/styles`, `components/ui` | Tokens + screens match spec | M | Low |
| 3 | Windows mpv IPC integration | 1 | `src-tauri/src/media/mpv.rs`, `commands/mpv.rs` | Spawn, connect, command, events | L | High |
| 4 | Local MP4/MKV playback | 3 | Media Lab UI + commands | Play/pause/seek verified | M | Medium |
| 5 | GPU hardware decoding test | 4 | diagnostics, report | `hwdec-current` captured; 4K test | M | Medium |
| 6 | Fastify backend skeleton | — | `services/api/**` | Health + config + migrations run | M | Low |
| 7 | WebSocket room connections | 6 | `realtime/**`, `rooms/**` | Two clients join; presence | L | Medium |
| 8 | PlaybackTimeline implementation | 6, 7 | `timeline/**`, `packages/protocol` | Pure tests; revisions; ready gating | L | Medium |
| 9 | PostgreSQL room/chat schemas | 6 | `migrations/**` | Migrate/rollback; constraints | M | Low |
| 10 | Docker Compose deployment | 6, 9 | `infra/**`, `Dockerfile` | Stack healthy on VPS | M | Medium |
| 11 | Two-computer sync test | 3–10 | test harness, report | p95 ≤150 ms; reconnect | XL | High |

Complexity: S ≤ 1 day, M 1–3 days, L 3–5 days, XL 5–10 days for one
experienced engineer. These are estimates, not commitments.

## 14. Quality gates

Every change:

- `pnpm typecheck`, `pnpm lint`, unit tests; `cargo fmt --check`,
  `cargo clippy -- -D warnings`, `cargo test`.
- No new dependency without a reason, license check, and lockfile update.
- No `unwrap()` on network/process paths in Rust; typed errors.
- No secrets, tokens, local paths, or media URLs in logs.
- Protocol changes update Zod, tests, and `docs/protocol.md` in the same PR.
- Performance-sensitive changes include a measurement note.

Before a sprint is called done:

- Acceptance checklist signed with evidence (logs, CSV, screenshots, report).
- Known limitations updated.
- Rollback path for server changes documented.
- A fresh clone can build and run from the README.

## 15. Test matrix

| Scenario | Sprint | Evidence |
|---|---|---|
| Same Wi-Fi, two PCs | 3 | Drift CSV |
| Different networks | 3 | Drift CSV |
| 50–200 ms latency, jitter, 1% loss | 3 | Harness report |
| Client disconnect/reconnect | 3 | Snapshot + drift log |
| 1080p / 4K / 8K | 0, 4 | Decoder + dropped frames |
| H.264 / HEVC / AV1 / VP9 | 4 | Playback matrix |
| Playback speeds 0.5–2.0 | 3, 4 | Drift CSV |
| Subtitles SRT/ASS, audio tracks | 4 | Screenshots + track list |
| Two-hour soak | 3, 7 | Memory/CPU samples |
| TURN-forced voice | 5 | ICE logs + call quality |
| Room full / expired / invalid invite | 2 | API tests |
| Server restart recovery | 3 | Snapshot test |
| Installer on clean VM | 7 | Video/screenshots |

## 16. Effort estimate

Rough order of magnitude for one experienced engineer with AI assistance:

| Sprint | Estimate |
|---|---|
| 0 — Media PoC | 3–5 days |
| 1 — UI | 4–6 days |
| 2 — Backend/rooms | 5–7 days |
| 3 — Sync | 6–10 days |
| 4 — Media sources | 6–10 days |
| 5 — Chat/voice | 5–8 days |
| 6 — Website adapters | 6–12 days (high uncertainty) |
| 7 — Release | 6–10 days |
| **Total** | **41–68 person-days** |

The estimate excludes domain purchase, code-signing procurement, and the
owner's review time. Sprint 6 is the least predictable because it depends on
third-party player policies.

## 17. Open decisions for the owner

1. Production domain and VPS provider.
2. Project license and whether the repository is public.
3. Code-signing certificate (OV/EV) and identity details.
4. Bundle mpv (GPL compliance plan) or require a user install in v1.
5. YouTube adapter priority; if low, ship MVP without it and keep the framework.
6. Whether chat history should persist beyond the room TTL (currently deleted
   with the room after 24 h).

## 18. Definition of done (MVP)

- Two people on different computers create/join a private room and watch the
  same local file or direct source on one timeline.
- p95 drift ≤150 ms measured on two real machines with a documented method.
- 4K playback verified on the build machine; 8K reported honestly.
- Chat works; voice works when enabled; both are independent of playback.
- Reconnect and server restart recover without manual re-sync.
- No video bytes through the VPS.
- Signed Windows installer (or an explicitly documented unsigned private build).
- Security checklist passed; secrets never committed.
- A fresh engineer can deploy from `docs/deployment.md` without asking questions.
