# Architecture

Status: baseline for Sprint 0–3. Updated 2026-11-14.

## 1. System context

```text
┌──────────────────────────┐          ┌──────────────────────────┐
│  DESKTOP A (Windows)     │          │  DESKTOP B (Windows)     │
│  Tauri 2 + React         │          │  Tauri 2 + React         │
│  Rust native layer       │          │  Rust native layer       │
│  mpv process (local)     │          │  mpv process (local)     │
└───────────┬──────────────┘          └───────────┬──────────────┘
            │ WSS (sync, chat, voice signaling)   │
            │ REST (rooms, auth, ICE)             │
            └───────────────┬─────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  CADDY (TLS)   │
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │ FASTIFY + WS   │
                    │ room manager   │
                    │ timeline engine│
                    │ chat / auth    │
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │  POSTGRESQL    │
                    └────────────────┘

        voice media (only when enabled, peer-to-peer)
        A  ◄════════════════════════════════════►  B
                 STUN, or TURN if NAT fails
```

Video bytes never traverse Caddy, Fastify or the VPS. Each client opens the
same source locally or fetches it source-direct from the origin. The server
stores a media descriptor, not the media.

## 2. Component responsibilities

| Component | Owns | Never does |
|---|---|---|
| React UI | Screens, design system, local view state | Decide the canonical timeline |
| Rust native layer | mpv lifecycle, IPC, file/URL probing, local fingerprint, secret storage | Render video into the WebView |
| mpv process | Decode, render, audio, subtitles, hardware acceleration | Network coordination |
| Protocol package | Zod schemas, timeline math, shared TS types | I/O |
| Fastify API | Auth, rooms, membership, config, ICE credentials | Fetch or proxy video |
| WS hub | Timeline authority, presence, chat delivery, voice signaling | Store large payloads |
| PostgreSQL | Users, rooms, members, chat, timeline snapshots | Serve the hot playback path |
| coturn | STUN/TURN for voice | Relay video |

## 3. Desktop process model

```text
Tauri main process
├── WebView2 (React UI)
└── Rust core
    ├── AppState
    │   ├── MpvManager  ── named pipe ──► mpv.exe
    │   ├── SyncClient  ── WebSocket ──► Fastify
    │   └── Settings / token store
    └── Tauri commands + events
```

One `MpvManager` owns at most one mpv child process. The manager is the only
code allowed to spawn, command, or kill it. The React layer talks to the
manager through typed Tauri commands and receives throttled status events.

### Why a separate mpv process

- Crash isolation: a decoder or GPU driver failure kills mpv, not the app.
- No C ABI/FFI ownership hazards in the first iteration.
- The same IPC contract can later be backed by embedded libmpv behind a trait.
- Packaging can treat mpv as an external runtime dependency during the MVP.

The cost is a second window (or an embedded `--wid` child window later) and a
process boundary. Sprint 0 measures both before the UI promises in-window video.

### mpv launch contract

```text
mpv.exe
  --no-config
  --input-ipc-server=\\.\pipe\absolute-cinema-mpv-<pid>-<nonce>
  --idle=yes
  --keep-open=yes
  --force-window=yes
  --no-terminal
  --osc=no
  --input-default-bindings=no
  --hwdec=auto-safe
  --vo=gpu-next        # default; ABSOLUTE_CINEMA_MPV_VO=gpu overrides it
  --gpu-api=d3d11
  --audio-pitch-correction=yes
  --cache=yes
  --demuxer-max-bytes=512MiB
  --demuxer-readahead-secs=30
  --msg-level=all=warn
  --title=ABSOLUTE-CINEMA
```

- `--no-config` makes playback deterministic; a user's `mpv.conf` cannot
  silently change hardware decoding or speed.
- `--keep-open=yes` keeps the last frame and the process alive at EOF.
- `--hwdec=auto-safe` prefers a safe hardware path and falls back to software.
  The actual path is read from `hwdec-current`, never assumed.
- `--force-window=yes` is the Sprint 0 default. The embedding spike replaces it
  with `--wid=<child HWND>` and a documented ownership/cleanup path.
- `ABSOLUTE_CINEMA_MPV_VO` is a diagnostics escape hatch only. If an older
  Windows driver performs better on the stable `gpu` backend than on
  `gpu-next`, the evidence run records both instead of silently changing the
  product default.

### IPC contract

mpv's JSON IPC is newline-delimited JSON over a Windows named pipe:

```json
{"command":["loadfile","C:\\movies\\film.mkv"],"request_id":1}
{"request_id":1,"error":"success"}
{"event":"property-change","id":2,"name":"pause","data":false}
```

Rust responsibilities:

- Connect with retry while mpv creates the pipe (50 ms backoff, 5 s cap).
- One writer task serializes requests; one reader task parses responses and
  events; a pending-map resolves request IDs with timeouts.
- Poll `time-pos` at 4 Hz and emit a throttled `mpv:status` snapshot; subscribe
  to low-frequency properties (`pause`, `duration`, `speed`, `paused-for-cache`,
  `eof-reached`, `hwdec-current`, `video-params`, `track-list`).
- Emit the raw event stream on `mpv:event` for diagnostics.
- On app exit, send `quit`, wait 2 s, then kill the child; never leave an
  orphaned mpv.

Property names of record:

| Property | Use |
|---|---|
| `time-pos` | Playback position, seconds |
| `duration` | Media length, seconds (may be null) |
| `pause` | Paused state |
| `speed` | Playback rate |
| `paused-for-cache` | Buffering |
| `eof-reached` | End of file |
| `hwdec-current` | Actual decoder path |
| `video-params` | Resolution, pixel format, codec |
| `audio-params` | Codec, channels, sample rate |
| `track-list` | Audio/subtitle tracks |
| `media-title`, `path` | Display only (path is never sent to the server) |
| `frame-drop-count`, `decoder-frame-drop-count` | Performance evidence |

## 4. Synchronization engine

### 4.1 Timeline

```ts
type PlaybackTimeline = {
  mediaId: string | null;
  anchorPosition: number;   // seconds
  anchorServerTime: number; // epoch ms, server clock
  playbackRate: number;
  paused: boolean;
  revision: number;         // monotonic
  controllerId: string | null;
};
```

Position is derived, never stored as a moving value:

```
P(t) = anchorPosition + ((t - anchorServerTime) / 1000) * playbackRate
```

When `paused`, `P(t) = anchorPosition`. The server re-anchors on every accepted
mutation: it computes the current position, writes a new anchor at `now`, and
increments `revision`.

### 4.2 Authority

Only the server mutates the canonical timeline. A client sends an *intent*:

```json
{"event":"playback.intent","roomId":"...","action":"seek","position":812.4,"baseRevision":17}
```

The server validates membership, rate limits, media readiness and revision. If
`baseRevision` is stale, it rejects with `stale_revision` and sends the current
snapshot; the client must not retry a stale intent blindly.

Both participants may control. `controllerId` is the last accepted author, not
a permission gate. Host-only actions are room lifecycle actions.

### 4.3 Server clock

- Server time is `Date.now()` (epoch ms).
- Clients estimate offset with ping/pong:
  - client sends `t0` (client monotonic epoch), server replies `{t0, tServer, t1}`.
  - `rtt = t1 - t0`; `offset = tServer + rtt/2 - t1`.
  - keep a rolling window, discard samples with `rtt > 4 × p20`, take the
    median offset, require at least 6 survivors for `confident: true`.
- Use `performance.timeOrigin + performance.now()` as the client clock, not
  `Date.now()`, so an NTP step does not corrupt samples.
- Probe in a fast burst (6 probes at 250 ms) then every 5 s; reset on reconnect
  and on resume from sleep.

### 4.4 Applying a state update

```
apply(update):
  if update.revision <= current.revision: discard
  target = positionAt(update, estimatedServerNow() + APPLY_LEAD_MS)
  current.revision = update.revision
  if paused: seek(target) if |local - target| > 80ms; pause
  else:
    if first load or |local - target| > 250ms: seek(target); play
    else: keep playing; let the correction loop converge
```

`APPLY_LEAD_MS` is 120–200 ms, chosen so both clients start moving near the
same instant despite one-way latency. The exact value is measured in Sprint 3.

### 4.5 Drift correction

Inputs: local `time-pos`, target `positionAt(timeline, serverNow)`, nominal
rate, clock confidence, buffering, cooldown.

| Absolute drift | Action |
|---|---|
| 0–80 ms | none |
| 80–250 ms | nudge local `speed` by ±5% until inside the dead band, max 3 s |
| > 250 ms sustained for 2 checks, or > 1000 ms once | seek to target |

Rules:

- Never correct while paused, buffering, seeking, or during a 1.5 s cooldown
  after a user action.
- Never correct while the clock estimate is not confident; a wrong clock
  produces a seek storm.
- Nudge uses mpv `speed`, then restores the timeline rate. `--audio-pitch-correction`
  keeps speech natural.
- A seek is visible; the UI may show a brief "syncing" indicator rather than
  pretending nothing happened.

The brief's 0–80 / 80–250 / >250 ms bands are the starting point. The
250 ms hard-seek boundary is stricter than playercn's 1.5 s, as required by the
150 ms p95 goal; the exact values are configuration, tuned by measurement.

### 4.6 Buffering and "Keep us in sync"

When enabled (default):

1. A client detects `paused-for-cache`.
2. It sends `playback.report {buffering:true, position, wallClock}`.
3. The server pauses the canonical timeline at the current position and
   broadcasts `playback.state` with `reason:"buffering"`.
4. Both players pause; the buffering client recovers.
5. When it reports `buffering:false` + `ready`, the server schedules a resume
   with a 300–500 ms lead, then broadcasts.
6. If recovery exceeds 10 s, the UI offers "continue without waiting".

When disabled, the server does not pause; the affected client catches up with
the normal correction loop. The setting is per room and stored with the room.

### 4.7 Reconnection

- WS reconnect uses exponential backoff (0.5 s → 15 s, jitter).
- On open, client sends `room.resume {roomId, lastRevision}`.
- Server replies `room.snapshot` containing room, members, timeline, media
  descriptor, recent chat and voice state.
- Client applies the snapshot only if `revision` is newer; local media stays
  loaded. If the media descriptor differs, the client pauses and asks the user
  to reopen the correct source.
- The server keeps a room alive for 24 h after the last member disconnects;
  the timeline is rehydrated from the last PostgreSQL snapshot. Clients may
  resume the same position after a server restart.

## 5. Media sources

### 5.1 Local files

Flow: file dialog → Rust probes path (`fs::metadata`, extension) → mpv loads it
→ status reports duration, tracks, video params, decoder → client builds a
descriptor → `media.propose` → partner confirms `media.ready` → timeline may
start.

The local absolute path is sent to mpv only. The server receives:

```json
{
  "kind": "local",
  "name": "film.mkv",
  "sizeBytes": 41234567890,
  "durationSec": 7245.2,
  "fingerprint": "sha256:first4MiB+last4MiB+size:...",
  "video": {"codec":"hevc","width":3840,"height":2160,"hdr":true},
  "audio": [{"codec":"eac3","channels":6,"lang":"en"}],
  "subtitle": [{"codec":"ass","lang":"tr"}]
}
```

### 5.2 Direct URLs

Supported: HTTP(S) progressive files and HLS/DASH where mpv's FFmpeg build
supports them. Validation on the client:

- scheme `http`/`https` only; reject `file:`, `javascript:`, `data:`, custom
  schemes.
- reject URLs with embedded credentials for the server descriptor; mpv may
  still use a local URL with credentials if the user explicitly enters it, but
  it is redacted before any log or server message.
- `HEAD`/range probe with a 5 s timeout, max 5 redirects, re-validate each
  redirect. Read at most 16 KiB of headers.
- detect `Content-Type`, `Content-Length`, `Accept-Ranges`; do not infer codec
  from the extension alone.
- when the server eventually needs a remote metadata fetch, it must block
  loopback, RFC1918, link-local, CGNAT, multicast and IPv6 ULA, and re-resolve
  after redirects (see `docs/security.md`).

No full download before playback. mpv streams with its cache; the app never
buffers a whole film in RAM.

### 5.3 Same-media verification

Both clients must load the same content. The descriptor is the handshake:

- Local: name + size + duration + sampled fingerprint. Full SHA-256 is opt-in.
- URL: normalized URL hash + size + duration + ETag/Last-Modified when present.
- A mismatch is a hard warning, not a silent sync: "Your file differs from your
  partner's (size 41.2 GB vs 41.1 GB). Play anyway?"
- The server stores only the descriptor; it never receives the file or path.

## 6. Backend

### Modules

```text
services/api/src/
├── app.ts                 Fastify instance, plugins, error handler
├── server.ts              process entry, graceful shutdown
├── config.ts              env validation (Zod)
├── auth/                  device tokens, WS tickets
├── rooms/                 create/join/get/close, invite tokens, TTL cleanup
├── timeline/              pure timeline math (shared with protocol tests)
├── realtime/              WS hub, sessions, protocol dispatch
├── chat/                  persistence + delivery + rate limit
├── voice/                 ICE config, TURN credentials, signaling relay
└── db/                    migrations, queries, pool
```

Fastify plugins: `@fastify/websocket`, `@fastify/cors` (desktop origin only),
`@fastify/helmet`, `@fastify/rate-limit`, `@fastify/sensible`. Validate every
REST body and WS frame with Zod from `packages/protocol`.

### Hot path

The timeline is pure and synchronous. A WS intent handler does: auth check →
room lookup (memory) → revision check → compute new anchor → mutate room
memory → broadcast. No database write on the hot path; a debounced snapshot
(500 ms) writes the timeline to PostgreSQL. This keeps control latency in
single-digit milliseconds on a 2 vCPU VPS.

### Data model

See `docs/protocol.md` for the full SQL. Summary:

- `users` — device identity, display name.
- `rooms` — host, status, invite token hash, settings, timestamps.
- `room_members` — max two, role, joined_at.
- `chat_messages` — text, created_at, optional reaction target.
- `room_timeline_snapshots` — one row per room, updated on mutation (debounced).
- `sessions` / `ws_tickets` — hashed tokens with expiry.

Expired rooms are deleted by a periodic job (hourly) after a 24 h grace period;
chat is cascaded.

### Auth flow

1. `POST /v1/auth/guest` with a display name → `{userId, deviceToken}`.
2. Device token is stored in Windows Credential Manager (never localStorage).
3. `POST /v1/auth/ws-ticket` (Bearer device token) → 60 s single-use ticket.
4. WS first frame `authenticate {ticket}`; the server consumes the ticket and
   binds the socket to the user. A socket that does not authenticate within 5 s
   is closed.
5. Room join requires the invitation token; membership is enforced on every
   event.

This deviates from the brief's illustrative `JWT_SECRET`: opaque tokens are
easier to revoke and do not put session semantics in a second format. The API
still issues short-lived credentials for WS.

### Chat

- Client sends `chat.send {clientId, content}`.
- Server validates length (≤ 2000 chars), rate limit (10 messages / 10 s),
  persists, assigns server id/time, broadcasts `chat.message` to both.
- Client renders text nodes only; no HTML/markdown injection.
- History is paginated by keyset (`before` id), max 50 per page.
- Chat delivery is independent of playback; it must not cause the player tree
  to rerender (selector-based store).

### Voice

- Disabled by default; no microphone permission at launch.
- On enable, client requests `GET /v1/voice/ice` → STUN URLs + time-limited
  TURN credentials (HMAC-SHA1 of `expiry:username` with `TURN_SECRET`).
- Signaling is relayed over the existing WS: `voice.signal {to, sdp|candidate}`.
- Two peers, one `RTCPeerConnection`; Opus; `echoCancellation`, `noiseSuppression`,
  `autoGainControl`.
- Mute disables the track; disable stops all tracks and closes the peer
  connection. No media process remains when voice is off.
- Coturn relay is used only when ICE fails; audio bandwidth is negligible.

## 7. Website adapters (phase 6)

`SiteAdapter` interface:

```ts
interface SiteAdapter {
  id: string;
  canHandle(url: URL): boolean;
  initialize(): Promise<void>;
  getPlaybackState(): Promise<PlaybackState>;
  play(at?: number): Promise<void>;
  pause(): Promise<void>;
  seek(position: number): Promise<void>;
  destroy(): Promise<void>;
}
```

Adapters are isolated modules with explicit capability flags. Direct files and
HLS/DASH are native mpv paths, not website adapters. YouTube uses the official
IFrame player in a controlled WebView; DRM services are not supported. An
adapter may be disabled by a remote feature flag without shipping a new build.
Compatibility is documented per adapter; no "all sites" claim.

## 8. Performance principles

1. Video never enters the WebView. The UI renders controls, not frames.
2. `time-pos` is polled at 4 Hz in Rust and emitted as a snapshot; React does
   not subscribe to a 60 Hz store.
3. The scrubber is an isolated subscriber; chat is virtualized; selectors are
   narrow.
4. mpv is a separate process, so decode/render work does not block the UI
   thread.
5. No blur/filter effects over the video surface; AMOLED means true black, not
   expensive compositing.
6. Voice resources are created on demand and destroyed on disable.
7. No server-side transcoding, no Redis, no message broker, no polling loops
   that wake the CPU when idle.
8. Memory and CPU are measured in Sprint 7 with repeatable scripts; claims are
   tied to evidence.

## 9. Stack rationale

### Tauri vs Electron

Tauri uses the OS WebView2 instead of bundling Chromium. The installer is
smaller, idle RAM is lower, and the native layer is Rust with a narrow command
surface. Electron offers a consistent Chromium and easier native module
ecosystem; we do not need Chromium consistency because video is not rendered in
the WebView. Tauri's cost is WebView2 variance and a less mature native-window
story for video embedding — which is exactly why Sprint 0 validates the media
engine before the UI depends on it.

### mpv vs HTML5 video

mpv/FFmpeg supports MKV, ASS subtitles, multiple audio tracks, HEVC/AV1/VP9,
HDR, hardware decode through D3D11VA and high-resolution files without browser
codec limits. HTML5 video in WebView2 cannot open local MKV reliably, has
limited subtitle/audio-track control, and cannot match mpv's decoder coverage.
The cost is process/window integration and GPL/licensing care.

### Role of each language

- **Rust**: process lifecycle, IPC, filesystem, URL probing, fingerprints,
  secure token storage, native window work, performance-sensitive loops.
- **TypeScript/React**: screens, design system, local interaction state,
  protocol validation on the client.
- **Node/Fastify**: room API, WS fan-out, persistence, signaling. The hot path
  is tiny and single-server; Node's event loop is adequate at two users per
  room and hundreds of rooms. Rust would reduce tail jitter but adds a second
  runtime and slows iteration; the baseline stays Node unless measurements
  show unacceptable control latency.
- **WebSocket**: ordered, reliable, proxy-friendly transport for timeline,
  chat and signaling. Video is not sent over it.

## 10. Failure matrix

| Failure | Detection | Response |
|---|---|---|
| mpv missing | Spawn error | Settings screen with install path; no crash |
| mpv crashes | Child exit event | UI error, restart button, room timeline continues |
| IPC timeout | Request timeout 2 s | Mark engine unhealthy, reconnect once, then restart |
| WS drop | Close/error | Backoff reconnect, snapshot resume |
| Server restart | WS drop + failed resume | Reconnect, snapshot from DB, continue |
| Clock jump (sleep) | Offset discontinuity | Reset samples, re-burst, suppress corrections |
| Buffering | `paused-for-cache` | Keep-us-in-sync pause/resume |
| Media mismatch | Descriptor compare | Hard warning, explicit override |
| URL 403/404/redirect loop | Probe/mpv error | Typed error, no retry storm |
| Room expired | 404/410 on resume | Clear local room state, offer new room |
| TURN unreachable | ICE failure | Show voice unavailable; playback unaffected |

## 11. Known deviations from the brief

1. Opaque device tokens + WS tickets instead of JWT (security/simplicity).
2. Client-side media probing; server never fetches media URLs (SSRF reduction).
3. Timeline snapshots persisted (debounced) despite "in-memory first", to
   survive server restarts without Redis.
4. Sampled fingerprint default instead of full SHA-256 (latency).
5. mpv external process in the MVP, libmpv embedding deferred to a spike.
6. YouTube/DRM explicitly out of the MVP.
