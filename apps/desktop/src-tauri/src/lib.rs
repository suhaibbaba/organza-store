//! The Organza desktop shell. It loads the same web build as the browser and adds what a
//! browser cannot do: keep the refresh token in the OS secure store, print receipts straight
//! to the ESC/POS printer, open the cash drawer, and install signed updates.
//!
//! Command names are called from apps/web/src/shared/platform/desktop.ts; keep them in step.

mod printing;
mod secrets;
mod update;

use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
struct AppInfo {
    version: String,
    os: &'static str,
}

#[tauri::command]
fn app_info(app: tauri::AppHandle) -> AppInfo {
    AppInfo {
        version: app.package_info().version.to_string(),
        os: std::env::consts::OS,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // A second launch (double-click on the shortcut) brings the open window forward.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            app_info,
            secrets::secret_get,
            secrets::secret_set,
            secrets::secret_delete,
            printing::list_printers,
            printing::print_raw,
            update::update_check,
            update::update_install,
        ])
        .run(tauri::generate_context!())
        .expect("Organza could not start");
}
