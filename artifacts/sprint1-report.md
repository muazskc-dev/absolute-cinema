# Sprint 1 — Monochrome UI and room experience report

**Date:** 2026-11-16
**Branch:** `feat/sprint-1-ui-design`
**Scope:** desktop UI/UX and local room-experience prototypes. No server,
authentication, synchronization, WebRTC or persistence code is included in this
sprint.

**Verdict:** Sprint 1 is complete on the build machine. Every required screen and
local prototype flow is implemented, the Sprint 0 mpv engine and Media Lab are
preserved, the final UI gates pass, and the screenshots in
`artifacts/sprint-1/screenshots/` were captured from the running Tauri window.
Rooms, passwords and chat are deliberately in-memory demo data; nothing in this
report claims server persistence or cross-device behavior.

## Build machine

| Component | Value |
|---|---|
| CPU | AMD Ryzen 7 5700U, 8 cores / 16 threads |
| RAM | 5.8 GB usable |
| GPU | AMD Radeon integrated, 2 GB shared |
| OS | Windows 11 Pro 10.0.26300 |
| Display | 1920×1080, 60 Hz, **125% scaling (native)** |
| mpv | `v0.42.0-3-g902818753` at `C:\Program Files\MPV Player\mpv.exe` |
| Node / pnpm | 26.13.0 / 12.18.0 |
| Rust | 1.100.0 stable-msvc |

The 125% figure is the real desktop setting. 100% and 150% were checked with
Chrome DevTools Protocol device-metrics emulation at a 1280×768 content size;
they are not claims about a real OS-level scaling change. See
[Scaling and responsive checks](#scaling-and-responsive-checks).

## What shipped

### Design system

- Strict monochrome tokens in `apps/desktop/src/styles.css`: pure black and
  neutral grays only. No accent hue, gradients, glows, glassmorphism or colored
  status badges.
- Geist Variable and Geist Mono Variable bundled locally through
  `@fontsource-variable/geist` and `@fontsource-variable/geist-mono` v5.3.0. The
  packages carry the OFL 1.1 license.
- Type scale limited to 10, 11, 12, 13, 14, 16, 22 and 26 px. The earlier 9, 15
  and 20 px values were removed.
- Spacing scale 4/8/12/16/24/32/48/64 px; golden-ratio compositions on Home,
  Waiting Room and Cinema Room.
- Visible `:focus-visible` rings, reduced-motion handling driven by
  `data-reduced-motion`, monochrome range controls and scrollbars.

### Shell and navigation

- 52 px application header; native Windows title bar retained.
- 224 px sidebar, collapsible to 64 px. `Ctrl+B` toggles it and the preference
  survives reload. Below 1180 px it collapses automatically.
- Main page container maxes out near 1000 px. Default window 1280×768, minimum
  1100×720.
- Sidebar starts with `+ New room`; Recent rooms is derived from all non-archived
  rooms sorted by `lastActiveAt`.

### Screens

| Surface | Status |
|---|---|
| Home | Implemented; golden-ratio active/recent split; demo label |
| Active Rooms | Implemented; live-session cards |
| Room History | Implemented; search, status filter, sort, protected filter, archived filter, row actions |
| Create Room | Implemented; name, password protection, 12-character minimum, confirmation match |
| Join Room | Implemented; invitation code, password step, full-room, unknown, archived and unavailable states |
| Waiting Room | Implemented; invitation copy, partner simulation, lifecycle controls |
| Cinema Room | Implemented; real mpv bridge, source bar, transport controls, details, lifecycle controls |
| Chat Drawer | Implemented; 336 px drawer, local messages, scroll position survives closing |
| Voice Panel | Prepared; explains the future WebRTC work and never requests a microphone |
| Settings | Implemented; General, Audio, Advanced; preferences persist under `ac.preferences.v1` |
| Developer Lab | Implemented; all Sprint 0 media, diagnostics and event-stream functionality preserved |

### Room prototype

Lifecycle states are `DORMANT → WAKING → WAITING → LIVE → RECONNECTING →
DORMANT`. The transitions are local UI state only; no presence server or sync
timeline exists. The contract and backend expectations are documented in
[`docs/rooms/room-lifecycle.md`](../docs/rooms/room-lifecycle.md).

Demo invitation codes:

| Code | Room | State |
|---|---|---|
| `AC-WAIT` | Weekend Movie | Waiting, 1/2 |
| `AC-7F2K` | Private Cinema | Dormant, password `cinema-night` |
| `AC-FULL` | Friday Cinema | Live, 2/2, unprotected |
| `AC-RECN` | Movie Night | Reconnecting |
| `AC-SUN1` | Sunday Screening | Dormant |
| `AC-NY24` | Archived room | Not joinable |

Unknown codes and archived rooms show explicit errors. Room passwords live only
in memory and are never written to local storage. Server-side password hashing
(Argon2id), TLS and rate limiting remain future work and are not faked.

## Evidence

### Automated gates

All commands were run on the final working tree on 2026-11-16.

| Check | Command | Result |
|---|---|---|
| TypeScript | `pnpm --filter @absolute-cinema/desktop typecheck` | pass |
| Frontend build | `pnpm --filter @absolute-cinema/desktop build` | pass; 532 kB JS chunk warning only |
| Rust format | `cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --all -- --check` | pass |
| Clippy | `cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings` | pass |
| Rust unit tests | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | 7 passed |
| mpv smoke tests | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test mpv_smoke -- --ignored --nocapture --test-threads=1` | 4 passed in 113.09 s |

The mpv smoke run used generated local media and a local HTTP server for the URL
case. Observed on this machine:

- 1080p: `gpu-next`, `d3d11va`, first frame 7.71 s, 53 display drops over 4.97 s,
  0 decoder drops.
- 4K: `gpu-next`, `d3d11va`, first frame 4.16 s, 104 display drops over 4.93 s,
  0 decoder drops.
- Engine evidence: 20 start/stop cycles with no orphan `mpv.exe`; IPC control
  p50 1.4 ms, p95 2.9 ms; multitrack audio and subtitles discovered; URL seek
  landed at 8.0 s.
- 8K: software decode, position 0.083 s after 17.37 s of observation. It is a
  slideshow on this machine and is not presented as usable playback.

These are background-window build-machine numbers, not smoothness claims for
other hardware. The Sprint 0 4K/8K limitations are unchanged.

### Interaction and state checks

Checks were performed against the live Tauri window through the WebView2
DevTools Protocol.

| Check | Observed |
|---|---|
| Dialog focus trap | 14 consecutive Tab presses stayed inside Create Room; Escape closed it and focus returned to the `Create room` trigger |
| Dialog fit | Create, Join, password, Voice and reset dialogs fit 1280×768 and 1100×720 without clipped text |
| Player shortcuts | Space, Right (+5 s), Shift+Left (−30 s), Down (volume 95), M (mute/unmute), C (chat), Escape (close) |
| Shortcut guard | With the chat textarea focused, the drawer stayed open, playback stayed paused and volume did not change |
| Disconnect | Status became `Reconnecting…`, toast shown |
| Reconnect | Status returned to `Live · 2/2`, toast shown |
| End room | Navigated to Room history; room stayed visible as `Dormant` with `Wake` and a toast |
| Join full room | `AC-FULL` showed `This room already has two participants.` |
| Join protected room | `AC-7F2K` prompted for a password; wrong password showed the generic error; `cinema-night` proceeded through waking to waiting |
| Join unknown/archived | Explicit errors; Escape closed the dialog |
| Chat | Opens, focuses the textarea, sends, updates the count, closes with Escape, keeps the message |
| Voice privacy | Panel opens; `Join voice` is disabled; instrumented `getUserMedia` calls = 0 |
| Settings persistence | Reduce motion toggles `data-reduced-motion`, survives reload; reset restores defaults and shows a toast |
| Sidebar | `Ctrl+B` 224 → 64 → 224 and persists; at 1100 px auto-collapses to 64 |
| Collapsed sidebar overflow | `scrollWidth 63 === clientWidth 63` after the fix |
| 1100×720 layout | No horizontal page overflow; Home/History/Cinema stack; no visible clipped text |

### Scaling and responsive checks

| Viewport / scale | Result |
|---|---|
| 1280×768 at 125% (native) | No overflow; sidebar 224; h1 26 px; content 1280×768 logical |
| 1280×768 at 100% (CDP emulation) | No overflow; sidebar 224; h1 26 px |
| 1280×768 at 150% (CDP emulation) | No overflow; sidebar 224; h1 26 px |
| 1100×720 at 125% (native) | No page overflow; sidebar auto-collapsed to 64; stacked layouts |

The 100%/150% checks validate CSS layout and device-pixel-ratio handling, not a
real OS display-setting change. A physical 100%/150% matrix remains a release
check on target hardware.

### Screenshots

All 20 images are in `artifacts/sprint-1/screenshots/`. They were captured from
the running Tauri window with Win32 `PrintWindow`, because the build machine's
desktop session was locked; they are not mockups or browser screenshots of a
static page. At 125% scaling the full window is 1618×1007 physical pixels,
including the native title bar; the content area is 1280×768 logical
(1600×960 physical). The 1100×720 captures are 1393×947 physical.

| File | Surface |
|---|---|
| `01-home-1280x768.png` | Home, expanded sidebar |
| `02-active-rooms-1280x768.png` | Active Rooms |
| `03-room-history-1280x768.png` | Room History, mixed states |
| `04-create-room-validation-1280x768.png` | Create Room validation errors |
| `05-waiting-room-1280x768.png` | Waiting Room |
| `06-chat-drawer-1280x768.png` | Chat Drawer |
| `07-cinema-room-idle-1280x768.png` | Cinema Room, mpv idle |
| `08-reconnecting-1280x768.png` | Reconnecting state |
| `09-dormant-history-1280x768.png` | Dormant room retained in history |
| `10-join-full-error-1280x768.png` | Join full-room error |
| `11-join-password-error-1280x768.png` | Join password error |
| `12-waking-1280x768.png` | Waking state |
| `13-settings-general-1280x768.png` | Settings, General |
| `14-settings-audio-1280x768.png` | Settings, Audio |
| `15-settings-advanced-1280x768.png` | Settings, Advanced |
| `16-developer-lab-1280x768.png` | Developer Lab |
| `17-voice-panel-1280x768.png` | Voice Panel, no microphone request |
| `18-home-1100x720.png` | Home at minimum window |
| `19-room-history-1100x720.png` | Room History at minimum window |
| `20-cinema-room-1100x720.png` | Cinema Room at minimum window |

## Defects found and fixed during the sprint

1. **Room history count copy** rendered `Showing 5 of 5 5 rooms`. The pluralized
   value was duplicated; the copy now reads `Showing 5 of 5 rooms`.
2. **Collapsed sidebar horizontal overflow** at 1100 px. The scroll container
   was 63 px wide with 71 px of content. `overflow-x-hidden` was added and a
   separator margin removed; re-verified at 63 = 63.
3. **Voice dialog focus leaked a tooltip over the title.** Initial focus landed
   on the close icon, whose `focus-within` tooltip appeared over the dialog
   header. The footer `Close` button now receives `data-autofocus`; the tooltip
   stays at opacity 0 on open.
4. **Voice copy orphaned `1.`** when the sentence wrapped. `Not connected in
   Sprint 1.` became `Voice is not connected yet.`
5. **Type-scale drift** from earlier UI work (9/15/20 px values) was removed so
   only the documented 10/11/12/13/14/16/22/26 px scale ships.
6. **Full-room demo was unreachable without an unadvertised password.**
   `AC-FULL` is now unprotected; the Friday Cinema lock icon was removed. The
   path is documented above.
7. **Golden-ratio breakpoint mismatch.** The implementation and visual spec now
   both switch at `min-[1180px]`.

## What is real, and what is not

**Real in this sprint**

- All UI, navigation, design tokens and the component system.
- Local room state and the wake/create/join/password/chat prototypes.
- The Sprint 0 mpv engine and IPC bridge, unchanged.
- Local preferences, reduced-motion behavior and chat state for the current
  window.
- The 20 screenshots and the test evidence in this report.

**Prototype or future work**

- Room persistence across app launches, devices or server restarts.
- Server-side authorization, password hashing (Argon2id), TLS, rate limiting and
  real invitation tokens.
- Shared playback timeline and server-authoritative synchronization.
- WebRTC voice, coturn relay, device selection and microphone permission.
- Embedded mpv rendering; playback still opens a separate mpv window.
- Automated E2E/visual-regression suites; verification here is manual plus
  ad-hoc CDP scripts.
- A physical 100%/150% scaling matrix and production installer testing.
- Code splitting for the 532 kB frontend chunk.

## Known environment limitations

- The Windows desktop session was locked during screenshot capture.
  `PrintWindow` captures the real application window, but it is not a compositor
  screenshot of the visible desktop.
- Windows excluded TCP ports 1420 and 1430 from the ephemeral range during this
  session. Development used a temporary Tauri config on port 1530 outside the
  repository. The committed Vite/Tauri configuration still targets 1420.
- The build machine has about 5.8 GB usable RAM. The debug Tauri process was run
  against a small static server for the final checks to keep memory pressure
  down.
- 4K decodes through D3D11VA but is not smooth; 8K falls back to software and is
  effectively a slideshow. No smooth 4K/8K claim is made.

## Acceptance criteria

| Criterion | Status |
|---|---|
| Monochrome identity across every screen | pass |
| Geist Sans/Mono bundled locally with license attribution | pass |
| Golden-ratio compositions on Home, Waiting Room, Cinema Room | pass |
| No decorative imagery, gradients, glows or colored status | pass |
| Sidebar expands/collapses and survives narrow windows | pass |
| Home, Active Rooms and Room History work with labeled demo data | pass |
| Create Room, Join Room, password states and Waiting Room work locally | pass |
| Dormant rooms are readable and wakeable; history persists in state | pass |
| Cinema Room exposes the real mpv bridge and states its window limitation | pass |
| Chat drawer opens/closes and preserves local messages | pass |
| Settings navigation works; preferences persist locally | pass |
| Developer Lab preserves Sprint 0 media functionality | pass |
| Dialogs fit 1280×768 and 1100×720; no clipped text | pass |
| Keyboard shortcuts and dialog focus behavior work | pass |
| Typecheck, build, Rust fmt, Clippy, Rust tests and media smoke tests pass | pass |
| Screenshots captured from the running Tauri app, not mockups | pass |
| Sprint 1 report states exactly what is real and what is prototype | this document |

## Next

Sprint 2 is server-authoritative rooms and synchronization: Fastify/WebSocket
room service, PostgreSQL persistence, real invitation/auth flow with Argon2id,
and the shared timeline contract. It has not been started.
