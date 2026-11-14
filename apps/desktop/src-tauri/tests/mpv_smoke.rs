//! Sprint 0 evidence run.
//!
//! This test is ignored by default because it needs a real `mpv` install and
//! the generated `test-media/` files. Run it explicitly:
//!
//! ```powershell
//! cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml `
//!   --test mpv_smoke -- --ignored --nocapture
//! ```
//!
//! It exercises the same `MpvManager` the desktop app uses: process spawn,
//! named-pipe IPC, playback control, telemetry, 20 start/stop cycles, and
//! honest 4K/8K decoder reporting. It does not fabricate playback claims.

use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use absolute_cinema_lib::media::{MpvEvents, MpvManager, PlayerSnapshot};
use serde_json::Value;

#[derive(Default)]
struct RecordingEvents {
    statuses: Mutex<Vec<PlayerSnapshot>>,
    events: Mutex<Vec<Value>>,
}

impl MpvEvents for RecordingEvents {
    fn emit_status(&self, snapshot: PlayerSnapshot) {
        self.statuses.lock().unwrap().push(snapshot);
    }

    fn emit_event(&self, event: Value) {
        self.events.lock().unwrap().push(event);
    }
}

fn test_media(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("..")
        .join("test-media")
        .join(name)
}

async fn wait_for<F>(manager: &MpvManager, timeout: Duration, mut predicate: F) -> PlayerSnapshot
where
    F: FnMut(&PlayerSnapshot) -> bool,
{
    let deadline = Instant::now() + timeout;
    loop {
        let snapshot = manager.status();
        if predicate(&snapshot) {
            return snapshot;
        }
        assert!(
            Instant::now() < deadline,
            "timed out waiting for engine state; last snapshot: {snapshot:?}"
        );
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

#[cfg(windows)]
fn process_exists(pid: u32) -> bool {
    use std::os::windows::process::CommandExt;

    let output = std::process::Command::new("tasklist")
        .arg("/FI")
        .arg(format!("PID eq {pid}"))
        .arg("/FO")
        .arg("CSV")
        .arg("/NH")
        .creation_flags(0x0800_0000)
        .output();

    output
        .map(|output| {
            let stdout = String::from_utf8_lossy(&output.stdout);
            stdout.contains(&format!("\"{pid}\""))
        })
        .unwrap_or(false)
}

#[cfg(not(windows))]
fn process_exists(pid: u32) -> bool {
    PathBuf::from(format!("/proc/{pid}")).exists()
}

#[test]
#[ignore = "requires installed mpv and generated test-media files"]
fn sprint0_4k_backend_sample() {
    sample_playback("sample-4k.mp4", 3840, "4K");
}

#[test]
#[ignore = "requires installed mpv and generated test-media files"]
fn sprint0_1080p_backend_sample() {
    sample_playback("sample-1080p.mp4", 1920, "1080p");
}

#[test]
#[ignore = "requires ABSOLUTE_CINEMA_TEST_URL and a running RANGE-capable server"]
fn sprint0_url_playback() {
    let url = std::env::var("ABSOLUTE_CINEMA_TEST_URL")
        .expect("set ABSOLUTE_CINEMA_TEST_URL to a Range-capable http(s) MP4");
    assert!(
        url.starts_with("http://") || url.starts_with("https://"),
        "URL test needs an http(s) target"
    );

    tauri::async_runtime::block_on(async {
        let recorder = Arc::new(RecordingEvents::default());
        let events: Arc<dyn MpvEvents> = recorder.clone();
        let manager = MpvManager::new();

        let started = manager.start(events).await.expect("engine start");
        let pid = started.pid.expect("engine pid");
        manager.open(&url).await.expect("open URL");
        let loaded = wait_for(&manager, Duration::from_secs(30), |snapshot| {
            snapshot.duration.is_some() && snapshot.video.is_some()
        })
        .await;
        println!(
            "URL loaded: duration={:?} resolution={}x{:?} hwdec={:?}",
            loaded.duration,
            loaded
                .video
                .as_ref()
                .and_then(|video| video.width)
                .unwrap_or(0),
            loaded.video.as_ref().and_then(|video| video.height),
            loaded.hwdec
        );

        manager.set_paused(false).await.expect("URL play");
        let playing = wait_for(&manager, Duration::from_secs(30), |snapshot| {
            snapshot
                .position
                .map(|position| position > 0.3)
                .unwrap_or(false)
        })
        .await;
        println!("URL playing position: {:?}", playing.position);

        manager.seek(8.0, false).await.expect("URL seek");
        let seeked = wait_for(&manager, Duration::from_secs(20), |snapshot| {
            snapshot
                .position
                .map(|position| (7.5..8.5).contains(&position))
                .unwrap_or(false)
        })
        .await;
        println!("URL seek landed at {:?}", seeked.position);

        manager.stop().await;
        tokio::time::sleep(Duration::from_millis(500)).await;
        assert!(!process_exists(pid), "URL mpv process {pid} survived stop");
    });
}

fn sample_playback(media_name: &str, expected_width: i64, label: &str) {
    tauri::async_runtime::block_on(async {
        let recorder = Arc::new(RecordingEvents::default());
        let events: Arc<dyn MpvEvents> = recorder.clone();
        let manager = MpvManager::new();
        let media = test_media(media_name);
        let backend = std::env::var("ABSOLUTE_CINEMA_MPV_VO").unwrap_or_else(|_| "gpu-next".into());

        let started = manager.start(events).await.expect("engine start");
        let pid = started.pid.expect("engine pid");
        manager
            .open(media.to_str().expect("utf-8 path"))
            .await
            .expect("open sample");
        wait_for(&manager, Duration::from_secs(15), |snapshot| {
            snapshot
                .video
                .as_ref()
                .and_then(|video| video.width)
                .map(|width| width == expected_width)
                .unwrap_or(false)
        })
        .await;

        let unpause = Instant::now();
        manager.set_paused(false).await.expect("play");
        let playing = wait_for(&manager, Duration::from_secs(20), |snapshot| {
            snapshot
                .position
                .map(|position| position > 0.2)
                .unwrap_or(false)
        })
        .await;
        let first_frame_latency = unpause.elapsed();
        let baseline = manager.status();
        tokio::time::sleep(Duration::from_secs(5)).await;
        let end = manager.status();

        let position_advanced = end.position.unwrap_or(0.0) - baseline.position.unwrap_or(0.0);
        let frame_drops = end.frame_drops.unwrap_or(0) - baseline.frame_drops.unwrap_or(0);
        let decoder_drops =
            end.decoder_frame_drops.unwrap_or(0) - baseline.decoder_frame_drops.unwrap_or(0);
        println!(
            "{label} backend={backend} hwdec={:?} first-frame={:.2}s position-delta={:.2}s display-drops={frame_drops} ({:.1}/s) decoder-drops={decoder_drops} observed-position={:?}",
            playing.hwdec,
            first_frame_latency.as_secs_f64(),
            position_advanced,
            frame_drops as f64 / 5.0,
            end.position
        );

        manager.stop().await;
        tokio::time::sleep(Duration::from_millis(500)).await;
        assert!(!process_exists(pid), "mpv process {pid} survived stop");
    });
}

#[test]
#[ignore = "requires installed mpv and generated test-media files"]
fn sprint0_mpv_engine_evidence() {
    tauri::async_runtime::block_on(async {
        let recorder = Arc::new(RecordingEvents::default());
        let events: Arc<dyn MpvEvents> = recorder.clone();
        let manager = MpvManager::new();

        let executable = manager
            .executable_path()
            .expect("mpv executable was not found");
        println!("mpv executable: {}", executable.display());

        let hd = test_media("sample-1080p.mp4");
        let multi = test_media("sample-multitrack.mkv");
        let four_k = test_media("sample-4k.mp4");
        let eight_k = test_media("sample-8k.mp4");
        for path in [&hd, &multi, &four_k, &eight_k] {
            assert!(path.is_file(), "missing test media: {}", path.display());
        }

        // --- 1080p playback control -------------------------------------
        let started = manager
            .start(Arc::clone(&events))
            .await
            .expect("engine start");
        assert!(started.running);
        let pid = started.pid.expect("engine pid");
        println!("engine pid: {pid}");

        manager
            .open(hd.to_str().expect("utf-8 path"))
            .await
            .expect("open 1080p");
        let loaded = wait_for(&manager, Duration::from_secs(10), |snapshot| {
            snapshot.duration.is_some() && snapshot.video.is_some()
        })
        .await;
        let duration = loaded.duration.expect("duration");
        println!(
            "1080p loaded: duration={duration:.2}s codec={:?} resolution={}x{:?} tracks={}",
            loaded
                .video
                .as_ref()
                .and_then(|video| video.codec.as_deref()),
            loaded
                .video
                .as_ref()
                .and_then(|video| video.width)
                .unwrap_or(0),
            loaded.video.as_ref().and_then(|video| video.height),
            loaded.tracks.len()
        );
        assert!(
            (duration - 20.0).abs() < 0.5,
            "unexpected duration: {duration}"
        );
        assert_eq!(
            loaded.video.as_ref().and_then(|video| video.width),
            Some(1920)
        );

        let statuses_before_play = {
            let statuses = recorder.statuses.lock().unwrap();
            statuses.len()
        };

        manager.set_paused(false).await.expect("play");
        // The first presented frame can take a moment on a cold d3d11va
        // pipeline; what matters is that the position advances, not how
        // quickly the compositor warms up.
        let playing = wait_for(&manager, Duration::from_secs(10), |snapshot| {
            snapshot
                .position
                .map(|position| position > 0.5)
                .unwrap_or(false)
        })
        .await;
        let playing_position = playing.position.expect("playing position");
        println!(
            "playing: position={playing_position:.3}s paused={} speed={} hwdec={:?} buffering={}",
            playing.paused, playing.speed, playing.hwdec, playing.buffering
        );
        assert!(!playing.paused, "pause flag did not clear");

        let statuses_after_play = {
            let statuses = recorder.statuses.lock().unwrap();
            statuses.len()
        };
        let status_delta = statuses_after_play - statuses_before_play;
        println!("status events while waiting for playback: {status_delta}");
        assert!(
            status_delta >= 4,
            "expected roughly 4 Hz telemetry, got {status_delta}"
        );
        let event_count = {
            let events = recorder.events.lock().unwrap();
            events.len()
        };
        assert!(event_count > 0, "no property events were emitted");

        manager.set_paused(true).await.expect("pause");
        tokio::time::sleep(Duration::from_millis(400)).await;
        let paused_once = manager.status().position.expect("paused position");
        tokio::time::sleep(Duration::from_millis(700)).await;
        let paused_twice = manager.status().position.expect("paused position");
        println!("paused positions: {paused_once:.3}s -> {paused_twice:.3}s");
        assert!(
            (paused_twice - paused_once).abs() < 0.15,
            "position moved while paused: {paused_once} -> {paused_twice}"
        );

        manager.seek(10.0, false).await.expect("seek");
        let seeked = wait_for(&manager, Duration::from_secs(4), |snapshot| {
            snapshot
                .position
                .map(|position| (9.5..10.5).contains(&position))
                .unwrap_or(false)
        })
        .await;
        println!("seek landed at {:.3}s", seeked.position.unwrap_or(-1.0));

        manager.set_speed(1.25).await.expect("set speed");
        let speed = wait_for(&manager, Duration::from_secs(3), |snapshot| {
            (snapshot.speed - 1.25).abs() < 0.001
        })
        .await;
        println!("playback speed reported by mpv: {}", speed.speed);
        manager.set_speed(1.0).await.expect("reset speed");

        // --- IPC round-trip latency (control path) ----------------------
        let mut round_trips = Vec::with_capacity(20);
        for index in 0..20 {
            let rate = if index % 2 == 0 { 1.1 } else { 1.0 };
            let request = Instant::now();
            manager.set_speed(rate).await.expect("rate round trip");
            round_trips.push(request.elapsed());
        }
        round_trips.sort();
        let p50 = round_trips[round_trips.len() / 2];
        let p95 = round_trips[(round_trips.len() * 95 / 100).min(round_trips.len() - 1)];
        println!(
            "IPC control round-trip: p50={:.1}ms p95={:.1}ms max={:.1}ms",
            p50.as_secs_f64() * 1_000.0,
            p95.as_secs_f64() * 1_000.0,
            round_trips.last().unwrap().as_secs_f64() * 1_000.0
        );
        manager.set_speed(1.0).await.expect("reset speed");

        // --- multitrack MKV: two audio tracks, SRT + ASS subtitles ------
        manager
            .open(multi.to_str().expect("utf-8 path"))
            .await
            .expect("open multitrack");
        let multi_loaded = wait_for(&manager, Duration::from_secs(10), |snapshot| {
            snapshot.tracks.len() >= 4 && snapshot.video.is_some()
        })
        .await;
        let audio_tracks: Vec<_> = multi_loaded
            .tracks
            .iter()
            .filter(|track| track.track_type.as_deref() == Some("audio"))
            .collect();
        let subtitle_tracks: Vec<_> = multi_loaded
            .tracks
            .iter()
            .filter(|track| track.track_type.as_deref() == Some("sub"))
            .collect();
        println!(
            "multitrack: audio={:?} subtitles={:?}",
            audio_tracks
                .iter()
                .map(|track| (
                    track.language.clone(),
                    track.codec.clone(),
                    track.title.clone()
                ))
                .collect::<Vec<_>>(),
            subtitle_tracks
                .iter()
                .map(|track| (
                    track.language.clone(),
                    track.codec.clone(),
                    track.title.clone()
                ))
                .collect::<Vec<_>>()
        );
        assert_eq!(audio_tracks.len(), 2, "expected two audio tracks");
        assert_eq!(subtitle_tracks.len(), 2, "expected two subtitle tracks");
        assert!(
            audio_tracks
                .iter()
                .any(|track| track.language.as_deref() == Some("tur")),
            "Turkish audio track was not reported"
        );
        assert!(
            subtitle_tracks
                .iter()
                .any(|track| track.codec.as_deref() == Some("ass")),
            "ASS subtitle track was not reported"
        );

        let stopped = manager.stop().await;
        assert!(!stopped.running);
        tokio::time::sleep(Duration::from_millis(500)).await;
        assert!(!process_exists(pid), "mpv process {pid} survived stop");

        // --- 20 start/stop cycles ---------------------------------------
        let mut cycle_pids = Vec::new();
        for cycle in 0..20 {
            let snapshot = manager
                .start(Arc::clone(&events))
                .await
                .unwrap_or_else(|error| panic!("cycle {cycle} start failed: {error}"));
            assert!(snapshot.running, "cycle {cycle} did not report running");
            let cycle_pid = snapshot.pid.expect("cycle pid");
            cycle_pids.push(cycle_pid);
            let stopped = manager.stop().await;
            assert!(!stopped.running, "cycle {cycle} did not stop");
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
        for cycle_pid in &cycle_pids {
            assert!(
                !process_exists(*cycle_pid),
                "orphan mpv process after cycle: {cycle_pid}"
            );
        }
        println!("20 start/stop cycles: no orphan processes");

        // --- 4K decoder evidence ----------------------------------------
        let four_k_started = manager
            .start(Arc::clone(&events))
            .await
            .expect("4K engine start");
        let four_k_pid = four_k_started.pid.expect("4K pid");
        manager
            .open(four_k.to_str().expect("utf-8 path"))
            .await
            .expect("open 4K");
        let four_k_loaded = wait_for(&manager, Duration::from_secs(15), |snapshot| {
            snapshot
                .video
                .as_ref()
                .and_then(|video| video.width)
                .map(|width| width == 3840)
                .unwrap_or(false)
        })
        .await;
        let four_k_unpause = Instant::now();
        manager.set_paused(false).await.expect("4K play");
        let four_k_playing = wait_for(&manager, Duration::from_secs(20), |snapshot| {
            snapshot
                .position
                .map(|position| position > 0.2)
                .unwrap_or(false)
        })
        .await;
        let four_k_present_latency = four_k_unpause.elapsed();
        tokio::time::sleep(Duration::from_millis(2_500)).await;
        let four_k_status = manager.status();
        println!(
            "4K evidence: resolution={}x{:?} codec={:?} hwdec={:?} drops={:?}/{:?} position={:?} first-frame-latency={:.2}s",
            four_k_loaded
                .video
                .as_ref()
                .and_then(|video| video.width)
                .unwrap_or(0),
            four_k_loaded.video.as_ref().and_then(|video| video.height),
            four_k_status
                .video
                .as_ref()
                .and_then(|video| video.codec.as_deref()),
            four_k_status.hwdec,
            four_k_status.frame_drops,
            four_k_status.decoder_frame_drops,
            four_k_playing.position,
            four_k_present_latency.as_secs_f64()
        );
        assert_eq!(
            four_k_status.video.as_ref().and_then(|video| video.height),
            Some(2160)
        );
        manager.stop().await;
        tokio::time::sleep(Duration::from_millis(500)).await;
        assert!(
            !process_exists(four_k_pid),
            "4K mpv process {four_k_pid} survived stop"
        );

        // --- 8K decoder evidence (reported honestly, not asserted smooth) -
        let eight_k_started = manager
            .start(Arc::clone(&events))
            .await
            .expect("8K engine start");
        let eight_k_pid = eight_k_started.pid.expect("8K pid");
        manager
            .open(eight_k.to_str().expect("utf-8 path"))
            .await
            .expect("open 8K");
        let eight_k_loaded = wait_for(&manager, Duration::from_secs(25), |snapshot| {
            snapshot
                .video
                .as_ref()
                .and_then(|video| video.width)
                .map(|width| width == 7680)
                .unwrap_or(false)
        })
        .await;
        let eight_k_unpause = Instant::now();
        manager.set_paused(false).await.expect("8K play");
        // 8K is not guaranteed on shared-memory integrated GPUs. Observe for
        // up to 15s and report what actually happened instead of pretending.
        let eight_k_deadline = Instant::now() + Duration::from_secs(15);
        let mut eight_k_progress = manager.status();
        while eight_k_progress
            .position
            .map(|position| position <= 0.2)
            .unwrap_or(true)
            && !eight_k_progress.eof
            && Instant::now() < eight_k_deadline
        {
            tokio::time::sleep(Duration::from_millis(200)).await;
            eight_k_progress = manager.status();
        }
        let eight_k_present_latency = eight_k_unpause.elapsed();
        tokio::time::sleep(Duration::from_millis(1_500)).await;
        let eight_k_status = manager.status();
        println!(
            "8K evidence: resolution={}x{:?} codec={:?} hwdec={:?} drops={:?}/{:?} position={:?} eof={} observed-for={:.2}s",
            eight_k_loaded
                .video
                .as_ref()
                .and_then(|video| video.width)
                .unwrap_or(0),
            eight_k_loaded.video.as_ref().and_then(|video| video.height),
            eight_k_status
                .video
                .as_ref()
                .and_then(|video| video.codec.as_deref()),
            eight_k_status.hwdec,
            eight_k_status.frame_drops,
            eight_k_status.decoder_frame_drops,
            eight_k_status.position,
            eight_k_status.eof,
            eight_k_present_latency.as_secs_f64()
        );
        assert_eq!(
            eight_k_status.video.as_ref().and_then(|video| video.height),
            Some(4320)
        );
        manager.stop().await;
        tokio::time::sleep(Duration::from_millis(500)).await;
        assert!(
            !process_exists(eight_k_pid),
            "8K mpv process {eight_k_pid} survived stop"
        );

        assert!(!manager.status().running);
        println!("Sprint 0 engine evidence run complete");
    });
}
