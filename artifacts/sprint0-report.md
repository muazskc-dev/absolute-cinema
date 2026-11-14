# Sprint 0 — Media engine evidence report

**Date:** 2026-11-14
**Scope:** local/direct-URL playback engine for ABSOLUTE-CINEMA. No sync, room,
chat, voice or server code exists yet; this report only covers the Windows media
layer that later sprints will drive.

**Verdict:** the process-isolated mpv engine is viable. Local MP4/MKV, multitrack
audio/subtitle discovery, play/pause/seek/rate, 4 Hz telemetry, URL playback and
process cleanup all work. 4K decodes through D3D11VA on this machine but is not
smooth; 8K falls back to software and is not usable. No smoothness claim is made
for either.

## Build machine

| Component | Value |
|---|---|
| CPU | AMD Ryzen 7 5700U, 8 cores / 16 threads |
| RAM | 5.8 GB usable |
| GPU | AMD Radeon integrated, 2 GB shared, driver 31.0.21912.3005 |
| OS | Windows 11 Pro 10.0.26300 |
| Display | 1920×1080, 60 Hz, 125% scaling (1020 px usable height) |
| mpv | `v0.42.0-3-g902818753` at `C:\Program Files\MPV Player\mpv.exe` |
| ffmpeg/ffprobe | 9.0.2-full_build (Gyan) |
| Node / pnpm | 26.13.0 / 12.18.0 |
| Rust | 1.100.0 stable-msvc |

The 4K/8K figures below are properties of this low-end shared-memory iGPU, not
universal product claims. A target-hardware matrix is still required.

## Test media

Generated locally with ffmpeg and verified with ffprobe; `test-media/` is
gitignored.

| File | Video | Audio | Subtitles | Duration |
|---|---|---|---|---|
| `sample-1080p.mp4` | H.264 1920×1080 | AAC mono | — | 20.0 s |
| `sample-multitrack.mkv` | H.264 1920×1080 | AAC `eng`, Opus `tur` (mono) | SRT `eng`, ASS `tur` | 20.0 s |
| `sample-4k.mp4` | H.264 3840×2160 | — | — | 10.0 s |
| `sample-8k.mp4` | H.264 7680×4320 | — | — | 4.0 s |

Generation commands are in the repository history and reproduce with any
ffmpeg build containing libx264, AAC, libopus and ASS support.

## Evidence runs

All runs use the real `MpvManager` (spawn, named-pipe IPC, telemetry, cleanup).
The tests are `#[ignore]`d because they need mpv and generated media.

```powershell
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml `
  --test mpv_smoke -- --ignored --nocapture --test-threads=1
```

### Engine and controls

| Check | Observed |
|---|---|
| mpv spawn | one process, engine pid reported |
| 1080p load | `duration=20.00s`, 1920×1080, 2 tracks |
| Decoder | `d3d11va` (read from `hwdec-current`, not assumed) |
| Play | position advanced past 0.5 s; `buffering=false` |
| 4 Hz telemetry | status events arrived while waiting; no manual refresh |
| IPC control round-trip | p50 1.0 ms, p95 2.1 ms, max 2.1 ms over 20 `set_property` calls |
| Pause | 0.600 s → 0.600 s after 700 ms |
| Seek | landed at 10.000 s |
| Rate | mpv reported 1.25× || Multitrack MKV | AAC `eng` + Opus `tur`; SRT `eng` + ASS `tur` discovered with titles |
| 20 start/stop cycles | no orphan `mpv.exe` |
| Stop cleanup | engine `running=false`; process gone within 500 ms |
| Direct URL | 20 s MP4 over local HTTP; position advanced to 0.566 s; seek landed at 8.0 s (Range request) |

### Resolution and frame pacing

Five-second steady-state samples after the first presented frame. Display drops
are cumulative `frame-drop-count` deltas; decoder drops are
`decoder-frame-drop-count` deltas.

| Sample | Backend | HW decode | First frame | Position delta | Display drops | Decoder drops |
|---|---|---|---|---|---|---|
| 1080p | gpu-next | d3d11va | 6.44 s | 5.00 s | 37 (7.4/s) | 0 |
| 4K | gpu-next | d3d11va | 4.71 s | 4.67 s | 108 (21.6/s) | 0 |
| 4K | gpu | d3d11va | 2.04 s | 4.80 s | 104 (20.8/s) | 0 |

The 1080p baseline also drops frames in this instrumented, background-window
run, which means the absolute numbers include environment noise (shared GPU,
remote/agent session, compositor). The relative signal is still clear: 4K is
roughly three times worse than 1080p, and the stable `gpu` backend did not fix
it. Playback position stays real-time; the renderer is skipping presentation.

### 4K and 8K in the full engine run

- 4K: 3840×2160, `hwdec-current=d3d11va`, first frame 2.14 s, 46 display drops
  in the first 2.5 s, 0 decoder drops.
- 8K: 7680×4320, `hwdec-current=no` (software), first frame not presented
  within 7.5 s of observation; position reached 0.375 s of a 4 s clip,
  `eof=false`, 2 display drops, 0 decoder drops. Effectively a slideshow on this
  machine.

The 8K sample opens and reports its true resolution and decode path. The product
must surface this as a client capability limit, not silently promise 8K.

## Defects found and fixed during the evidence run

1. **Playback readiness was asserted with a fixed 1.8 s sleep.** The cold
   D3D11VA pipeline needed longer, producing a false failure at position 0.3 s.
   The test now waits for the position to advance and reports first-frame
   latency.
2. **The 2 s IPC timeout also applied to user control commands.** On 4K/8K files
   the `set_property pause` reply can legitimately wait on decoder setup, so
   Play was reported as failed while mpv eventually acted. Telemetry keeps the
   2 s budget; control commands now have a 15 s budget (`CONTROL_TIMEOUT`).
3. **Crash/exit was not reflected in status.** When the IPC pipe closed without
   a stop request, the snapshot could keep claiming `running=true`. The reader
   now marks the engine stopped and emits a final status.
4. **Orphan-process risk.** The child is spawned with `kill_on_drop(true)` and
   `stop()` performs graceful `quit`, aborts tasks, then kills after a bounded
   wait. Twenty cycles and every evidence stop left no process behind.
5. **Default window did not fit a 125%-scaled 1080p screen.** 1440×900 logical
   became 1818×1102 physical against a 1020 px work area. The default is now
   1280×768; min size remains 1100×720.

## UI verification

The Tauri window launches and renders the AMOLED Media Lab. Beyond the visual
capture, the running UI was driven through Windows UI Automation:

- `Start engine` spawned exactly one mpv process and the header switched to
  `ENGINE LIVE` with the reported PID.
- A direct URL was typed into the deck and loaded; the title became
  `sample-1080p.mp4`, resolution `1920×1080`, decoder `d3d11va`, state `paused`.
- `Play` advanced the clock to `0:04 / 0:20` and state `playing`; `Pause`
  returned it to `paused`.
- Closing the app window with the engine running left **zero** `absolute-cinema`
  and **zero** `mpv` processes.

The event stream showed live mpv property events (`paused-for-cache`, etc.), and
the diagnostics panel reported PID, drops, pixel format (`nv12`), color
(`bt.1886`) and the real mpv version.

## Acceptance against the Sprint 0 plan

- [x] App launches on Windows and spawns exactly one mpv process.
- [x] Local MP4 and MKV open and play.
- [x] Play, pause, seek, rate change work through the engine commands (UI wired).
- [x] Position and duration update at 4 Hz; control round-trip measured.
- [x] `hwdec-current` is reported and never guessed.
- [x] 4K opens; drop counters recorded. **Not smooth on this machine.**
- [x] 8K attempt recorded honestly: software decode, not usable here.
- [x] Closing the app with the engine running leaves no `mpv.exe` behind.
- [x] `cargo test`, `cargo clippy --all-targets -- -D warnings`, `pnpm typecheck` pass.

## Reproduce

```powershell
# from the repository root
pnpm typecheck
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings

# engine evidence (needs mpv + test-media)
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml `
  --test mpv_smoke -- --ignored --nocapture --test-threads=1

# URL evidence
node scripts/serve-test-media.mjs test-media 8787
$env:ABSOLUTE_CINEMA_TEST_URL = "http://127.0.0.1:8787/sample-1080p.mp4"
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml `
  --test mpv_smoke sprint0_url_playback -- --ignored --nocapture

# UI
pnpm dev
```

`ABSOLUTE_CINEMA_MPV_VO=gpu` switches the diagnostic backend from the default
`gpu-next`; it exists to compare drivers, not to change the product default
silently.

## Open decisions

- Target client hardware and the minimum smooth-playback promise (1080p only,
  or 4K on a named GPU class).
- 8K policy: allow with a warning, or refuse above a capability threshold.
- Keep mpv as an external dependency or bundle it (GPLv2+ obligations) before
  release.
- Embedded `--wid` child window versus the separate mpv window.
- Whether `gpu-next` or `gpu` should be the default after testing on the real
  target machines; this report does not decide it from one iGPU.
