mod commands;
pub mod media;

use commands::mpv::{
    mpv_executable, mpv_open, mpv_pause, mpv_play, mpv_seek, mpv_set_property, mpv_set_speed,
    mpv_start, mpv_status, mpv_stop, mpv_toggle_pause, mpv_version,
};
use media::MpvManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(MpvManager::new())
        .invoke_handler(tauri::generate_handler![
            mpv_start,
            mpv_stop,
            mpv_status,
            mpv_open,
            mpv_play,
            mpv_pause,
            mpv_toggle_pause,
            mpv_seek,
            mpv_set_speed,
            mpv_set_property,
            mpv_version,
            mpv_executable,
        ])
        .build(tauri::generate_context!())
        .expect("error while building ABSOLUTE-CINEMA");

    app.run(|app_handle, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            let manager = app_handle.state::<MpvManager>();
            tauri::async_runtime::block_on(manager.stop());
        }
    });
}
