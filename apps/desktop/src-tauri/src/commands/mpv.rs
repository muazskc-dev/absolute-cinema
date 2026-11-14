use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

use crate::media::{MpvManager, PlayerSnapshot};

#[tauri::command]
pub async fn mpv_start(
    app: AppHandle,
    state: State<'_, MpvManager>,
) -> Result<PlayerSnapshot, String> {
    state
        .start(Arc::new(app))
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn mpv_stop(
    app: AppHandle,
    state: State<'_, MpvManager>,
) -> Result<PlayerSnapshot, String> {
    let snapshot = state.stop().await;
    let _ = app.emit("mpv:status", snapshot.clone());
    Ok(snapshot)
}

#[tauri::command]
pub async fn mpv_status(state: State<'_, MpvManager>) -> Result<PlayerSnapshot, String> {
    Ok(state.status())
}

#[tauri::command]
pub async fn mpv_open(
    app: AppHandle,
    state: State<'_, MpvManager>,
    target: String,
) -> Result<PlayerSnapshot, String> {
    let snapshot = state
        .open(&target)
        .await
        .map_err(|error| error.to_string())?;
    let _ = app.emit("mpv:status", snapshot.clone());
    Ok(snapshot)
}

#[tauri::command]
pub async fn mpv_play(state: State<'_, MpvManager>) -> Result<(), String> {
    state
        .set_paused(false)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn mpv_pause(state: State<'_, MpvManager>) -> Result<(), String> {
    state
        .set_paused(true)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn mpv_toggle_pause(state: State<'_, MpvManager>) -> Result<bool, String> {
    state
        .toggle_paused()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn mpv_seek(
    state: State<'_, MpvManager>,
    position: f64,
    relative: Option<bool>,
) -> Result<(), String> {
    state
        .seek(position, relative.unwrap_or(false))
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn mpv_set_speed(state: State<'_, MpvManager>, speed: f64) -> Result<(), String> {
    state
        .set_speed(speed)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn mpv_set_property(
    state: State<'_, MpvManager>,
    name: String,
    value: Value,
) -> Result<(), String> {
    state
        .set_property(&name, value)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn mpv_version(state: State<'_, MpvManager>) -> Result<String, String> {
    state.mpv_version().await.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn mpv_executable(state: State<'_, MpvManager>) -> Result<Option<String>, String> {
    Ok(state
        .executable_path()
        .map(|path| path.to_string_lossy().into_owned()))
}
