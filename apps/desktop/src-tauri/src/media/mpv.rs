//! mpv process lifecycle and JSON IPC.
//!
//! One process, one named pipe (Windows) or Unix socket, one owner. The React
//! layer never talks to mpv directly; it calls typed Tauri commands and listens
//! to throttled `mpv:status` events.

use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    process::Stdio,
    sync::{
        Arc, Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use serde_json::{Value, json};
use tauri::{AppHandle, Emitter};
use thiserror::Error;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader, BufWriter},
    process::{Child, Command},
    sync::{mpsc, oneshot, watch},
    time::{MissedTickBehavior, timeout},
};

#[cfg(windows)]
type PipeStream = tokio::net::windows::named_pipe::NamedPipeClient;
#[cfg(unix)]
type PipeStream = tokio::net::UnixStream;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(2);
/// Control commands can legitimately wait on a cold hardware decoder or an 8K
/// software decode. Telemetry keeps the short timeout; user actions do not get
/// reported as failures just because the first frame is expensive.
const CONTROL_TIMEOUT: Duration = Duration::from_secs(15);
const CONNECT_DEADLINE: Duration = Duration::from_secs(5);
const STATUS_INTERVAL: Duration = Duration::from_millis(250);

const OBSERVED_PROPERTIES: &[&str] = &[
    "pause",
    "duration",
    "speed",
    "volume",
    "mute",
    "paused-for-cache",
    "seeking",
    "eof-reached",
    "hwdec-current",
    "media-title",
    "path",
    "video-params",
    "audio-params",
    "track-list",
];

#[derive(Debug, Error)]
pub enum MpvError {
    #[error("mpv executable not found. Install mpv or set ABSOLUTE_CINEMA_MPV.")]
    ExecutableNotFound,
    #[error("failed to spawn mpv: {0}")]
    Spawn(String),
    #[error("mpv exited before its IPC pipe became available{0}")]
    EarlyExit(String),
    #[error("timed out waiting for mpv IPC")]
    ConnectTimeout,
    #[error("mpv IPC error: {0}")]
    Ipc(String),
    #[error("mpv request timed out")]
    RequestTimeout,
    #[error("mpv is not running")]
    NotRunning,
    #[error("invalid media target: {0}")]
    InvalidTarget(String),
}

/// Where player telemetry goes. Tauri's `AppHandle` implements this in the app;
/// integration tests use a recording sink to exercise the engine headlessly.
pub trait MpvEvents: Send + Sync + 'static {
    fn emit_status(&self, snapshot: PlayerSnapshot);
    fn emit_event(&self, event: Value);
}

impl MpvEvents for AppHandle {
    fn emit_status(&self, snapshot: PlayerSnapshot) {
        let _ = self.emit("mpv:status", snapshot);
    }

    fn emit_event(&self, event: Value) {
        let _ = self.emit("mpv:event", event);
    }
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct VideoInfo {
    pub codec: Option<String>,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub pixel_format: Option<String>,
    pub hw_pixel_format: Option<String>,
    pub color_primaries: Option<String>,
    pub gamma: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AudioInfo {
    pub codec: Option<String>,
    pub sample_rate: Option<i64>,
    pub channels: Option<i64>,
    pub channel_layout: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrackInfo {
    pub id: Option<i64>,
    #[serde(rename = "type")]
    pub track_type: Option<String>,
    pub title: Option<String>,
    pub language: Option<String>,
    pub codec: Option<String>,
    pub selected: bool,
    pub external: bool,
    pub default: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerSnapshot {
    pub running: bool,
    pub pid: Option<u32>,
    pub position: Option<f64>,
    pub duration: Option<f64>,
    pub paused: bool,
    pub speed: f64,
    pub volume: f64,
    pub muted: bool,
    pub buffering: bool,
    pub seeking: bool,
    pub eof: bool,
    pub hwdec: Option<String>,
    pub video: Option<VideoInfo>,
    pub audio: Option<AudioInfo>,
    pub tracks: Vec<TrackInfo>,
    pub title: Option<String>,
    pub path: Option<String>,
    pub frame_drops: Option<i64>,
    pub decoder_frame_drops: Option<i64>,
    pub last_error: Option<String>,
}

impl Default for PlayerSnapshot {
    fn default() -> Self {
        Self {
            running: false,
            pid: None,
            position: None,
            duration: None,
            paused: true,
            speed: 1.0,
            volume: 100.0,
            muted: false,
            buffering: false,
            seeking: false,
            eof: false,
            hwdec: None,
            video: None,
            audio: None,
            tracks: Vec::new(),
            title: None,
            path: None,
            frame_drops: None,
            decoder_frame_drops: None,
            last_error: None,
        }
    }
}

struct IpcCommand {
    id: u64,
    command: Vec<Value>,
}

type PendingMap = HashMap<u64, oneshot::Sender<Result<Value, String>>>;

#[derive(Clone)]
struct MpvHandle {
    tx: mpsc::Sender<IpcCommand>,
    pending: Arc<tokio::sync::Mutex<PendingMap>>,
    next_id: Arc<AtomicU64>,
}

impl MpvHandle {
    async fn command(&self, command: Vec<Value>) -> Result<Value, MpvError> {
        self.command_with_timeout(command, REQUEST_TIMEOUT).await
    }

    async fn command_with_timeout(
        &self,
        command: Vec<Value>,
        budget: Duration,
    ) -> Result<Value, MpvError> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (reply_tx, reply_rx) = oneshot::channel();
        self.pending.lock().await.insert(id, reply_tx);

        if self.tx.send(IpcCommand { id, command }).await.is_err() {
            self.pending.lock().await.remove(&id);
            return Err(MpvError::Ipc("mpv writer stopped".into()));
        }

        match timeout(budget, reply_rx).await {
            Ok(Ok(Ok(value))) => Ok(value),
            Ok(Ok(Err(error))) => Err(MpvError::Ipc(error)),
            Ok(Err(_)) => Err(MpvError::Ipc("mpv response channel closed".into())),
            Err(_) => {
                self.pending.lock().await.remove(&id);
                Err(MpvError::RequestTimeout)
            }
        }
    }

    async fn get_property(&self, name: &str) -> Result<Value, MpvError> {
        self.command(vec![json!("get_property"), json!(name)]).await
    }

    async fn set_property(&self, name: &str, value: Value) -> Result<(), MpvError> {
        self.command(vec![json!("set_property"), json!(name), value])
            .await
            .map(|_| ())
    }

    async fn set_property_with_timeout(
        &self,
        name: &str,
        value: Value,
        budget: Duration,
    ) -> Result<(), MpvError> {
        self.command_with_timeout(vec![json!("set_property"), json!(name), value], budget)
            .await
            .map(|_| ())
    }
}

struct MpvSession {
    handle: MpvHandle,
    child: Child,
    shutdown: watch::Sender<bool>,
    tasks: Vec<tauri::async_runtime::JoinHandle<()>>,
    pipe_path: String,
}

pub struct MpvManager {
    inner: Mutex<Option<MpvSession>>,
    status: Arc<Mutex<PlayerSnapshot>>,
}

impl MpvManager {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
            status: Arc::new(Mutex::new(PlayerSnapshot::default())),
        }
    }

    pub fn executable_path(&self) -> Option<PathBuf> {
        find_mpv_executable()
    }

    pub fn status(&self) -> PlayerSnapshot {
        self.status.lock().unwrap().clone()
    }

    fn handle(&self) -> Result<MpvHandle, MpvError> {
        self.inner
            .lock()
            .unwrap()
            .as_ref()
            .map(|session| session.handle.clone())
            .ok_or(MpvError::NotRunning)
    }

    /// Spawn mpv and connect to its IPC pipe. Idempotent: an existing session is
    /// stopped first so the app can never own two media processes.
    pub async fn start(&self, events: Arc<dyn MpvEvents>) -> Result<PlayerSnapshot, MpvError> {
        self.stop().await;

        let executable = find_mpv_executable().ok_or(MpvError::ExecutableNotFound)?;
        let pipe_path = make_pipe_path();

        let mut command = Command::new(&executable);
        // `ABSOLUTE_CINEMA_MPV_VO` is a diagnostics escape hatch: the stable
        // `gpu` backend can outperform `gpu-next` on older Windows drivers.
        let video_output =
            std::env::var("ABSOLUTE_CINEMA_MPV_VO").unwrap_or_else(|_| "gpu-next".to_string());
        command
            .arg("--no-config")
            .arg(format!("--input-ipc-server={pipe_path}"))
            .arg("--idle=yes")
            .arg("--keep-open=yes")
            .arg("--force-window=yes")
            .arg("--pause=yes")
            .arg("--no-terminal")
            .arg("--osc=no")
            .arg("--input-default-bindings=no")
            .arg("--hwdec=auto-safe")
            .arg(format!("--vo={video_output}"))
            .arg("--audio-pitch-correction=yes")
            .arg("--cache=yes")
            .arg("--demuxer-max-bytes=512MiB")
            .arg("--demuxer-readahead-secs=30")
            .arg("--msg-level=all=warn")
            .arg("--title=ABSOLUTE-CINEMA")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        #[cfg(windows)]
        {
            // CREATE_NO_WINDOW: mpv renders its own window; no console is needed.
            command.creation_flags(0x0800_0000);
            command.arg("--gpu-api=d3d11");
        }

        let mut child = command
            .spawn()
            .map_err(|error| MpvError::Spawn(error.to_string()))?;
        let pid = child.id();

        if let Some(stderr) = child.stderr.take() {
            let events = Arc::clone(&events);
            tauri::async_runtime::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    events.emit_event(json!({ "event": "stderr", "line": line }));
                }
            });
        }

        let started = Instant::now();
        let stream = loop {
            match connect_pipe(&pipe_path).await {
                Ok(stream) => break stream,
                Err(error) => {
                    if let Some(status) = child
                        .try_wait()
                        .map_err(|wait_error| MpvError::Spawn(wait_error.to_string()))?
                    {
                        return Err(MpvError::EarlyExit(format!(
                            " (exit {status}); last error: {error}"
                        )));
                    }
                    if started.elapsed() >= CONNECT_DEADLINE {
                        let _ = child.start_kill();
                        return Err(MpvError::ConnectTimeout);
                    }
                    tokio::time::sleep(Duration::from_millis(50)).await;
                }
            }
        };

        let (read_half, write_half) = tokio::io::split(stream);
        let (command_tx, command_rx) = mpsc::channel::<IpcCommand>(64);
        let (shutdown_tx, shutdown_rx) = watch::channel(false);
        let handle = MpvHandle {
            tx: command_tx,
            pending: Arc::new(tokio::sync::Mutex::new(HashMap::new())),
            next_id: Arc::new(AtomicU64::new(1)),
        };

        {
            let mut status = self.status.lock().unwrap();
            *status = PlayerSnapshot {
                running: true,
                pid,
                speed: 1.0,
                volume: 100.0,
                paused: true,
                ..PlayerSnapshot::default()
            };
        }

        let reader = tauri::async_runtime::spawn(reader_task(
            read_half,
            handle.pending.clone(),
            self.status.clone(),
            Arc::clone(&events),
        ));
        let writer = tauri::async_runtime::spawn(writer_task(
            command_rx,
            write_half,
            handle.pending.clone(),
        ));
        let ticker = tauri::async_runtime::spawn(ticker_task(
            handle.clone(),
            self.status.clone(),
            Arc::clone(&events),
            shutdown_rx,
        ));

        for (index, property) in OBSERVED_PROPERTIES.iter().enumerate() {
            let _ = handle
                .command(vec![
                    json!("observe_property"),
                    json!(index + 1),
                    json!(property),
                ])
                .await;
        }

        *self.inner.lock().unwrap() = Some(MpvSession {
            handle,
            child,
            shutdown: shutdown_tx,
            tasks: vec![reader, writer, ticker],
            pipe_path,
        });

        let snapshot = self.status();
        events.emit_status(snapshot.clone());
        Ok(snapshot)
    }

    /// Graceful quit, then a bounded kill. Always resets status and never leaves
    /// a child process behind.
    pub async fn stop(&self) -> PlayerSnapshot {
        let session = self.inner.lock().unwrap().take();
        if let Some(session) = session {
            let _ = session.shutdown.send(true);
            let _ = timeout(
                Duration::from_millis(750),
                session.handle.command(vec![json!("quit")]),
            )
            .await;

            for task in session.tasks {
                task.abort();
            }

            let mut child = session.child;
            if timeout(Duration::from_secs(2), child.wait()).await.is_err() {
                let _ = child.start_kill();
                let _ = child.wait().await;
            }

            #[cfg(unix)]
            {
                let _ = std::fs::remove_file(&session.pipe_path);
            }
            #[cfg(not(unix))]
            {
                let _ = session.pipe_path;
            }
        }

        let mut status = self.status.lock().unwrap();
        *status = PlayerSnapshot::default();
        status.clone()
    }

    pub async fn open(&self, target: &str) -> Result<PlayerSnapshot, MpvError> {
        validate_target(target)?;
        let handle = self.handle()?;

        // Hold the first frame until the UI or the sync engine asks for play.
        let _ = handle
            .set_property_with_timeout("pause", json!(true), CONTROL_TIMEOUT)
            .await;
        {
            let mut status = self.status.lock().unwrap();
            status.position = Some(0.0);
            status.duration = None;
            status.eof = false;
            status.last_error = None;
            status.video = None;
            status.audio = None;
            status.tracks.clear();
            status.title = None;
            status.path = Some(target.to_string());
        }
        handle
            .command_with_timeout(vec![json!("loadfile"), json!(target)], CONTROL_TIMEOUT)
            .await?;
        Ok(self.status())
    }

    pub async fn set_paused(&self, paused: bool) -> Result<(), MpvError> {
        self.handle()?
            .set_property_with_timeout("pause", json!(paused), CONTROL_TIMEOUT)
            .await
    }

    pub async fn toggle_paused(&self) -> Result<bool, MpvError> {
        let paused = !self.status.lock().unwrap().paused;
        self.set_paused(paused).await?;
        Ok(paused)
    }

    pub async fn seek(&self, position: f64, relative: bool) -> Result<(), MpvError> {
        if !position.is_finite() {
            return Err(MpvError::InvalidTarget(
                "seek position is not finite".into(),
            ));
        }
        let mode = if relative {
            "relative+exact"
        } else {
            "absolute+exact"
        };
        self.handle()?
            .command_with_timeout(
                vec![json!("seek"), json!(position), json!(mode)],
                CONTROL_TIMEOUT,
            )
            .await
            .map(|_| ())
    }

    pub async fn set_speed(&self, speed: f64) -> Result<(), MpvError> {
        if !is_playback_rate(speed) {
            return Err(MpvError::InvalidTarget(format!(
                "playback rate {speed} is outside 0.25–4.0"
            )));
        }
        self.handle()?
            .set_property_with_timeout("speed", json!(speed), CONTROL_TIMEOUT)
            .await
    }

    pub async fn set_property(&self, name: &str, value: Value) -> Result<(), MpvError> {
        if name.trim().is_empty() {
            return Err(MpvError::InvalidTarget("property name is empty".into()));
        }
        self.handle()?.set_property(name, value).await
    }

    pub async fn mpv_version(&self) -> Result<String, MpvError> {
        let handle = self.handle()?;
        let value = handle.get_property("mpv-version").await?;
        Ok(value.as_str().unwrap_or("unknown").to_string())
    }
}

impl Default for MpvManager {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for MpvManager {
    fn drop(&mut self) {
        if let Some(session) = self.inner.lock().unwrap().take() {
            let _ = session.shutdown.send(true);
            for task in session.tasks {
                task.abort();
            }
            let mut child = session.child;
            let _ = child.start_kill();
        }
    }
}

fn is_playback_rate(speed: f64) -> bool {
    speed.is_finite() && (0.25..=4.0).contains(&speed)
}

fn validate_target(target: &str) -> Result<(), MpvError> {
    let target = target.trim();
    if target.is_empty() {
        return Err(MpvError::InvalidTarget("target is empty".into()));
    }

    if target.starts_with("http://") || target.starts_with("https://") {
        let parsed = url::Url::parse(target)
            .map_err(|error| MpvError::InvalidTarget(format!("invalid URL: {error}")))?;
        if parsed.host_str().is_none() {
            return Err(MpvError::InvalidTarget("URL has no host".into()));
        }
        return Ok(());
    }

    if target.starts_with("file://") {
        return Err(MpvError::InvalidTarget(
            "use a local path instead of a file:// URL".into(),
        ));
    }

    if !Path::new(target).is_file() {
        return Err(MpvError::InvalidTarget(format!(
            "local file does not exist: {target}"
        )));
    }
    Ok(())
}

#[cfg(windows)]
fn make_pipe_path() -> String {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    format!(
        r"\\.\pipe\absolute-cinema-mpv-{}-{}",
        std::process::id(),
        nonce
    )
}

#[cfg(unix)]
fn make_pipe_path() -> String {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    std::env::temp_dir()
        .join(format!(
            "absolute-cinema-mpv-{}-{}.sock",
            std::process::id(),
            nonce
        ))
        .to_string_lossy()
        .into_owned()
}

#[cfg(windows)]
async fn connect_pipe(path: &str) -> std::io::Result<PipeStream> {
    tokio::net::windows::named_pipe::ClientOptions::new().open(path)
}

#[cfg(unix)]
async fn connect_pipe(path: &str) -> std::io::Result<PipeStream> {
    tokio::net::UnixStream::connect(path).await
}

async fn writer_task(
    mut receiver: mpsc::Receiver<IpcCommand>,
    write_half: tokio::io::WriteHalf<PipeStream>,
    pending: Arc<tokio::sync::Mutex<PendingMap>>,
) {
    let mut writer = BufWriter::new(write_half);
    while let Some(command) = receiver.recv().await {
        let mut line = json!({
            "command": command.command,
            "request_id": command.id,
        })
        .to_string();
        line.push('\n');

        if let Err(error) = writer.write_all(line.as_bytes()).await {
            fail_pending(&pending, format!("mpv pipe write failed: {error}")).await;
            break;
        }
        if let Err(error) = writer.flush().await {
            fail_pending(&pending, format!("mpv pipe flush failed: {error}")).await;
            break;
        }
    }
}

async fn reader_task(
    read_half: tokio::io::ReadHalf<PipeStream>,
    pending: Arc<tokio::sync::Mutex<PendingMap>>,
    status: Arc<Mutex<PlayerSnapshot>>,
    events: Arc<dyn MpvEvents>,
) {
    let mut lines = BufReader::new(read_half).lines();
    loop {
        match lines.next_line().await {
            Ok(Some(line)) => {
                if line.trim().is_empty() {
                    continue;
                }
                let value: Value = match serde_json::from_str(&line) {
                    Ok(value) => value,
                    Err(error) => {
                        events.emit_event(
                            json!({ "event": "parse-error", "line": line, "error": error.to_string() }),
                        );
                        continue;
                    }
                };

                if let Some(request_id) = value.get("request_id").and_then(Value::as_u64) {
                    if let Some(reply) = pending.lock().await.remove(&request_id) {
                        let error = value
                            .get("error")
                            .and_then(Value::as_str)
                            .unwrap_or("success");
                        if error == "success" {
                            let data = value.get("data").cloned().unwrap_or(Value::Null);
                            let _ = reply.send(Ok(data));
                        } else {
                            let _ = reply.send(Err(error.to_string()));
                        }
                    }
                } else if value.get("event").is_some() {
                    apply_event(&value, &status);
                    events.emit_event(value);
                }
            }
            Ok(None) => break,
            Err(error) => {
                events.emit_event(json!({ "event": "ipc-error", "error": error.to_string() }));
                break;
            }
        }
    }

    fail_pending(&pending, "mpv IPC closed".into()).await;

    // The pipe closed without a stop request: mpv exited or crashed. Report it
    // once so the UI does not keep claiming a live engine.
    let final_snapshot = {
        let mut snapshot = status.lock().unwrap();
        snapshot.running = false;
        snapshot.pid = None;
        snapshot.buffering = false;
        snapshot.clone()
    };
    events.emit_status(final_snapshot);
}

async fn fail_pending(pending: &Arc<tokio::sync::Mutex<PendingMap>>, message: String) {
    let mut pending = pending.lock().await;
    for (_, reply) in pending.drain() {
        let _ = reply.send(Err(message.clone()));
    }
}

async fn ticker_task(
    handle: MpvHandle,
    status: Arc<Mutex<PlayerSnapshot>>,
    events: Arc<dyn MpvEvents>,
    mut shutdown: watch::Receiver<bool>,
) {
    let mut interval = tokio::time::interval(STATUS_INTERVAL);
    interval.set_missed_tick_behavior(MissedTickBehavior::Delay);
    let mut tick: u64 = 0;

    loop {
        if !status.lock().unwrap().running {
            break;
        }

        tokio::select! {
            _ = interval.tick() => {
                let position = handle
                    .get_property("time-pos")
                    .await
                    .ok()
                    .and_then(|value| value.as_f64());
                let duration = handle
                    .get_property("duration")
                    .await
                    .ok()
                    .and_then(|value| value.as_f64());

                let (frame_drops, decoder_frame_drops) = if tick.is_multiple_of(4) {
                    (
                        handle.get_property("frame-drop-count").await.ok().and_then(|value| value.as_i64()),
                        handle.get_property("decoder-frame-drop-count").await.ok().and_then(|value| value.as_i64()),
                    )
                } else {
                    (None, None)
                };

                {
                    let mut snapshot = status.lock().unwrap();
                    snapshot.position = position;
                    if duration.is_some() {
                        snapshot.duration = duration;
                    }
                    if tick.is_multiple_of(4) {
                        if frame_drops.is_some() {
                            snapshot.frame_drops = frame_drops;
                        }
                        if decoder_frame_drops.is_some() {
                            snapshot.decoder_frame_drops = decoder_frame_drops;
                        }
                    }
                }

                let snapshot = status.lock().unwrap().clone();
                events.emit_status(snapshot);
                tick = tick.wrapping_add(1);
            }
            changed = shutdown.changed() => {
                if changed.is_err() || *shutdown.borrow() {
                    break;
                }
            }
        }
    }
}

fn apply_event(event: &Value, status: &Arc<Mutex<PlayerSnapshot>>) {
    let Some(name) = event.get("event").and_then(Value::as_str) else {
        return;
    };

    let mut snapshot = status.lock().unwrap();
    match name {
        "start-file" => {
            snapshot.eof = false;
            snapshot.position = Some(0.0);
            snapshot.duration = None;
            snapshot.video = None;
            snapshot.audio = None;
            snapshot.tracks.clear();
            snapshot.last_error = None;
        }
        "file-loaded" => {
            snapshot.eof = false;
        }
        "end-file" => match event.get("reason").and_then(Value::as_str).unwrap_or("") {
            "eof" => snapshot.eof = true,
            "error" => {
                snapshot.last_error = Some("playback ended with an error".to_string());
            }
            _ => {}
        },
        "property-change" => {
            let property = event.get("name").and_then(Value::as_str).unwrap_or("");
            match event.get("data") {
                Some(data) => apply_property(property, data, &mut snapshot),
                None => apply_property(property, &Value::Null, &mut snapshot),
            }
        }
        _ => {}
    }
}

fn apply_property(property: &str, data: &Value, snapshot: &mut PlayerSnapshot) {
    match property {
        "pause" => snapshot.paused = data.as_bool().unwrap_or(false),
        "duration" => snapshot.duration = data.as_f64(),
        "speed" => {
            if let Some(speed) = data.as_f64() {
                snapshot.speed = speed;
            }
        }
        "volume" => {
            if let Some(volume) = data.as_f64() {
                snapshot.volume = volume;
            }
        }
        "mute" => snapshot.muted = data.as_bool().unwrap_or(false),
        "paused-for-cache" => snapshot.buffering = data.as_bool().unwrap_or(false),
        "seeking" => snapshot.seeking = data.as_bool().unwrap_or(false),
        "eof-reached" => snapshot.eof = data.as_bool().unwrap_or(false),
        "hwdec-current" => {
            snapshot.hwdec = data
                .as_str()
                .filter(|value| !value.is_empty())
                .map(ToString::to_string);
        }
        "media-title" => {
            snapshot.title = data.as_str().map(ToString::to_string);
        }
        "path" => {
            snapshot.path = data.as_str().map(ToString::to_string);
        }
        "video-params" => {
            snapshot.video = data.as_object().map(|params| VideoInfo {
                codec: params.get("codec").and_then(stringish),
                width: params.get("w").and_then(Value::as_i64),
                height: params.get("h").and_then(Value::as_i64),
                pixel_format: params.get("pixelformat").and_then(stringish),
                hw_pixel_format: params.get("hw-pixelformat").and_then(stringish),
                color_primaries: params.get("color-primaries").and_then(stringish),
                gamma: params.get("gamma").and_then(stringish),
            });
        }
        "audio-params" => {
            snapshot.audio = data.as_object().map(|params| AudioInfo {
                codec: params.get("format").and_then(stringish),
                sample_rate: params.get("samplerate").and_then(Value::as_i64),
                channels: params.get("channel-count").and_then(Value::as_i64),
                channel_layout: params.get("layout").and_then(stringish),
            });
        }
        "track-list" => {
            snapshot.tracks = data
                .as_array()
                .map(|tracks| tracks.iter().filter_map(parse_track).collect())
                .unwrap_or_default();
        }
        _ => {}
    }
}

fn parse_track(track: &Value) -> Option<TrackInfo> {
    let object = track.as_object()?;
    Some(TrackInfo {
        id: object.get("id").and_then(Value::as_i64),
        track_type: object.get("type").and_then(stringish),
        title: object.get("title").and_then(stringish),
        language: object.get("lang").and_then(stringish),
        codec: object.get("codec").and_then(stringish),
        selected: object
            .get("selected")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        external: object
            .get("external")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        default: object
            .get("default")
            .and_then(Value::as_bool)
            .unwrap_or(false),
    })
}

fn stringish(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.clone()),
        Value::Array(items) => {
            let joined = items
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
                .join("+");
            if joined.is_empty() {
                None
            } else {
                Some(joined)
            }
        }
        _ => None,
    }
}

fn find_mpv_executable() -> Option<PathBuf> {
    if let Some(configured) = std::env::var_os("ABSOLUTE_CINEMA_MPV") {
        let candidate = PathBuf::from(configured);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    if let Some(path) = std::env::var_os("PATH") {
        for directory in std::env::split_paths(&path) {
            let candidate = directory.join(if cfg!(windows) { "mpv.exe" } else { "mpv" });
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    let mut candidates: Vec<PathBuf> = Vec::new();

    #[cfg(windows)]
    {
        if let Some(program_files) = std::env::var_os("ProgramFiles") {
            let program_files = PathBuf::from(program_files);
            candidates.push(program_files.join(r"MPV Player\mpv.exe"));
            candidates.push(program_files.join(r"mpv\mpv.exe"));
        }
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            let local = PathBuf::from(local_app_data);
            candidates.push(local.join(r"Microsoft\WinGet\Links\mpv.exe"));
            candidates.push(local.join(r"Programs\mpv\mpv.exe"));
        }
        candidates.push(PathBuf::from(r"C:\Program Files\MPV Player\mpv.exe"));
        candidates.push(PathBuf::from(r"C:\Program Files\mpv\mpv.exe"));
    }

    #[cfg(not(windows))]
    {
        candidates.push(PathBuf::from("/usr/bin/mpv"));
        candidates.push(PathBuf::from("/usr/local/bin/mpv"));
        candidates.push(PathBuf::from("/opt/homebrew/bin/mpv"));
    }

    candidates.into_iter().find(|candidate| candidate.is_file())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_status_is_paused_at_normal_speed() {
        let status = PlayerSnapshot::default();
        assert!(!status.running);
        assert!(status.paused);
        assert_eq!(status.speed, 1.0);
    }

    #[test]
    fn pause_and_buffer_properties_update_status() {
        let mut status = PlayerSnapshot::default();
        apply_property("pause", &json!(false), &mut status);
        apply_property("paused-for-cache", &json!(true), &mut status);
        apply_property("hwdec-current", &json!("d3d11va"), &mut status);
        assert!(!status.paused);
        assert!(status.buffering);
        assert_eq!(status.hwdec.as_deref(), Some("d3d11va"));
    }

    #[test]
    fn video_params_are_parsed_without_guessing() {
        let mut status = PlayerSnapshot::default();
        apply_property(
            "video-params",
            &json!({
                "codec": "hevc",
                "w": 3840,
                "h": 2160,
                "pixelformat": "p010",
                "hw-pixelformat": ["d3d11"],
                "color-primaries": "bt.2020",
                "gamma": "pq"
            }),
            &mut status,
        );
        let video = status.video.expect("video info");
        assert_eq!(video.codec.as_deref(), Some("hevc"));
        assert_eq!(video.width, Some(3840));
        assert_eq!(video.height, Some(2160));
        assert_eq!(video.hw_pixel_format.as_deref(), Some("d3d11"));
    }

    #[test]
    fn track_list_is_parsed() {
        let mut status = PlayerSnapshot::default();
        apply_property(
            "track-list",
            &json!([
                {"id": 1, "type": "audio", "lang": "en", "codec": "aac", "selected": true, "default": true},
                {"id": 2, "type": "sub", "lang": "tr", "codec": "ass", "external": true}
            ]),
            &mut status,
        );
        assert_eq!(status.tracks.len(), 2);
        assert_eq!(status.tracks[0].track_type.as_deref(), Some("audio"));
        assert!(status.tracks[0].selected);
        assert!(status.tracks[1].external);
    }

    #[test]
    fn playback_rate_validation_rejects_nan_and_out_of_range() {
        assert!(is_playback_rate(1.0));
        assert!(is_playback_rate(0.25));
        assert!(is_playback_rate(4.0));
        assert!(!is_playback_rate(0.1));
        assert!(!is_playback_rate(f64::NAN));
        assert!(!is_playback_rate(f64::INFINITY));
    }

    #[test]
    fn local_target_validation_rejects_missing_files() {
        let error = validate_target(r"C:\definitely\missing\movie.mkv").unwrap_err();
        assert!(matches!(error, MpvError::InvalidTarget(_)));
    }

    #[test]
    fn url_target_validation_rejects_file_scheme() {
        let error = validate_target("file:///C:/movie.mkv").unwrap_err();
        assert!(matches!(error, MpvError::InvalidTarget(_)));
        assert!(validate_target("https://example.com/movie.mp4").is_ok());
    }
}
