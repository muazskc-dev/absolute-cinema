# Open-source review — 2026-11-14

This document records what was actually inspected, on what date, and what may be
legally and technically reused. It is evidence, not a design essay.

Method:

- GitHub REST API for repository metadata (stars, license, last push, default branch).
- Recursive git tree listing to inspect the real file layout.
- Raw source reads of the synchronization and player-integration modules.
- License file existence checked directly (`raw.githubusercontent.com`).

## 1. Repository facts

| | WatchParty | playercn | SyncPlay |
|---|---|---|---|
| Repository | `howardchung/watchparty` | `ttherealdev/playercn` | `Syncplay/syncplay` |
| Stars / forks | 1,265 / 231 | 0 / 0 | 2,725 / 269 |
| Open issues | 77 | 0 | 68 |
| License (GitHub API) | **MIT** | **null — no license file** | **Apache-2.0** |
| Primary language | TypeScript | TypeScript + Rust | Python |
| Created | 2020-03-25 | 2026-07-30 | 2012-06-20 |
| Last push | 2026-11-13 | 2026-08-05 | 2026-10-12 |
| Archived | no | no | no |
| Default branch | `master` | `main` | `master` |

`playercn`'s README carries an MIT badge, but
`https://raw.githubusercontent.com/ttherealdev/playercn/main/LICENSE` returns
HTTP 404 and the GitHub API reports `license: null`. A badge is not a license.
**No code from playercn may be copied into ABSOLUTE-CINEMA.** It is a reading
reference only. This is the single most important legal finding of the review.

## 2. WatchParty

### What it is

A web watch-party product: React/Vite client, Express + Socket.IO server,
Firebase authentication, Stripe subscriptions, Redis, PostgreSQL, and optional
cloud virtual browsers. Rooms are public-ish URLs with an optional lock.

### Verified architecture facts

- Server dependencies include `express`, `socket.io`, `ioredis`, `pg`,
  `firebase-admin`, `stripe`, `discord.js`, `node-ssh`.
- `server/room.ts` keeps serialized room state including `video`, `videoTS`,
  `subtitle`, `playbackRate`, `paused`, `loop`, chat, playlist.
- Control events are `CMD:play`, `CMD:pause`, `CMD:seek`, `CMD:playbackRate`,
  `CMD:ts`, guarded by `validateLock()`.
- On connect the server emits `REC:host`, `REC:nameMap`, `REC:tsMap`, chat
  history, playlist and room state.
- Playback is HTML5/video.js in the browser, with YouTube, HLS, WebTorrent and
  screen-sharing paths.
- It does **not** have a server-authoritative extrapolated timeline. It
  broadcasts room state and timestamps, which is a weaker model than the one
  required here.

### Reuse decision

| Area | Decision | Reason |
|---|---|---|
| Server / room implementation | **Exclude** | Express + Socket.IO + Redis + Firebase + Stripe is far heavier than a two-person private room needs, and its sync model is not authoritative. |
| Socket event naming / room state concepts | **Study** | Useful vocabulary (`REC:host`, controller lock) but our protocol is new. |
| URL / YouTube metadata helpers | **Possible, with attribution** | MIT permits reuse; only if a concrete helper is better than a small rewrite. |
| Browser player | **Exclude** | Our player is mpv, not HTML5. |
| Virtual browser / WebTorrent / screen share | **Exclude** | Out of scope, high attack surface, requires server-side media infrastructure. |

The useful lesson is negative: a room-state broadcast is not a timeline. We
will not inherit that shortcut.

## 3. playercn

### What it is

A 2026 pre-release watch-party platform: Next.js/React browser client, Rust
Axum/Tokio server, PostgreSQL, Redis. It targets YouTube, direct files, HLS,
DASH and playlists, with voice chat and a shared queue.

### Verified architecture facts

- `apps/server/src/sync/timeline.rs` is a pure, I/O-free timeline module.
- Position is **derived, never stored**: `anchor_pos` + `anchor_at` + `rate` +
  `paused`, with a monotonic `version`.
- `awaitingStart` prevents the timeline from advancing before a client has
  actually buffered/loaded the source.
- `apps/server/src/realtime/protocol.rs` uses Rust enums with
  `#[serde(tag = "t")]`; unknown variants are rejected.
- `apps/web/src/realtime/clock.ts` implements a Cristian-style estimator with
  NTP filtering: use `performance.now()`-based monotonic time, discard
  high-RTT samples, take the median offset, require confidence before fine
  corrections.
- `packages/protocol/src/timeline.ts` defines `SYNC` constants:
  `DEAD_BAND_MS: 50`, `HARD_SEEK_MS: 1500`, `NUDGE_FACTOR: 0.05`,
  `CHECK_INTERVAL_MS: 1000`, `REPORT_INTERVAL_MS: 10_000`.
- The server uses Redis for timeline mirroring and room leases. This is a
  horizontal-scaling concern we do not need at two-person scale.
- The README claims 186 Rust tests and 15 protocol tests, but also admits
  there is no CI pipeline; badges are static. We did not run their suite.

### Reuse decision

| Area | Decision | Reason |
|---|---|---|
| Any source code | **Exclude** | No license file. |
| Derived-position timeline model | **Adopt as concept, rewrite** | Correct and well-suited to our problem. |
| Monotonic clock + low-RTT median estimator | **Adopt as concept, rewrite** | Right failure modes (NTP steps, queued packets). |
| Three-band drift correction | **Adopt with retuned thresholds** | Their 1.5 s hard-seek band is too tolerant for a cinema product; our target is tighter. |
| Rust server architecture | **Study only** | Our baseline is Node/Fastify; no need to change runtime. |
| Redis mirror / leases | **Exclude for MVP** | Single server, two users; PostgreSQL + in-memory timeline is sufficient. |

## 4. SyncPlay

### What it is

A long-running client/server system that synchronizes local media players
(mpv, VLC, MPC-HC, MPC-BE, IINA, mplayer) on multiple computers. It is the
closest existing product to the local-file half of ABSOLUTE-CINEMA.

### Verified architecture facts

- Apache-2.0; Python/Twisted; client and server in one repository.
- `syncplay/players/mpv.py` integrates via JSON IPC and supports multiple
  platforms, property get/set, file loading, OSD chat, pause/position
  reporting and player readiness.
- `syncplay/protocols.py` defines a line-delimited JSON protocol with
  `hello`, `set`, `state`, `list`, `chat`, `error` messages and a server-side
  room manager.
- `syncplay/server.py` has `RoomManager`, room persistence, controller
  authentication, ready flags and forced position updates.
- It synchronizes already-open local players; it does not own the UI or the
  media source abstraction.

### Reuse decision

| Area | Decision | Reason |
|---|---|---|
| mpv IPC lifecycle and property names | **Study, then implement in Rust** | Python library is not directly reusable, but the operational lessons are. |
| Line-delimited JSON message framing | **Adopt** | Simple, debuggable, works over WebSocket and named pipes. |
| Ready / buffering / controller semantics | **Study** | Directly relevant to `awaitingStart` and "Keep us in sync". |
| Python/Twisted code | **Exclude** | Runtime and language mismatch. |
| Room persistence model | **Study** | Informs our PostgreSQL snapshot policy. |

## 5. License and distribution notes

| Component | License | Implication |
|---|---|---|
| Tauri | MIT / Apache-2.0 | Permissive; keep notices. |
| React, Vite, Tailwind, Motion | MIT | Permissive. |
| Fastify, Zod, `ws` | MIT | Permissive. |
| PostgreSQL | PostgreSQL License | Permissive. |
| Caddy | Apache-2.0 | Permissive. |
| coturn | BSD-style | Permissive. |
| mpv (CLI binary) | GPLv2+ | Distributing a bundled mpv requires GPL compliance (source offer, notices). For the MVP we depend on a user-installed mpv and do not redistribute it. |
| libmpv (if embedded) | LGPLv2.1+ when built without GPL-only parts | Embedding needs a carefully licensed libmpv build and dynamic linking. Deferred until the embedding spike. |
| playercn | No license | **No reuse.** |
| WatchParty | MIT | Reuse allowed with copyright/permission notice. |
| SyncPlay | Apache-2.0 | Reuse allowed with NOTICE and license text. |

## 6. Foundation conclusion

Build ABSOLUTE-CINEMA as an independent Rust/Tauri application. Borrow
**concepts** from playercn (derived timeline, clock estimator, correction
bands), **operational patterns** from SyncPlay (mpv IPC, readiness, room
control), and **nothing structural** from WatchParty. No third-party source
code enters the repository in Sprint 0. If any MIT/Apache code is reused later,
it lands with its license text and a note in `docs/third-party-notices.md`.
