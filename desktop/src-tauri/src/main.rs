// A window around the deployed POS with no title bar; the page draws its own minimise and close.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::ipc::CapabilityBuilder;
use tauri::webview::{NewWindowResponse, WebviewWindowBuilder};
use tauri::{AppHandle, Manager, Url, WebviewUrl};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;

const MAIN_WINDOW: &str = "main";

// Set by the build (see .github/workflows/desktop-pos.yml); a local `tauri dev` opens the POS dev server.
const HOME_URL: &str = match option_env!("STORE_DESKTOP_URL") {
    Some(url) => url,
    None => "http://localhost:3001",
};
const WINDOW_TITLE: &str = match option_env!("STORE_DESKTOP_TITLE") {
    Some(title) => title,
    None => "Store POS",
};

const WINDOW_WIDTH: f64 = 1280.0;
const WINDOW_HEIGHT: f64 = 800.0;
const MIN_WIDTH: f64 = 800.0;
const MIN_HEIGHT: f64 = 560.0;

// Handed to Windows instead of loaded in the till's window: a map, a phone number, a WhatsApp chat.
const EXTERNAL_SCHEMES: [&str; 5] = ["http", "https", "mailto", "tel", "whatsapp"];

// The only things the remote page may ask of the machine: the four title-bar actions.
const WINDOW_PERMISSIONS: [&str; 5] = [
    "core:window:allow-close",
    "core:window:allow-minimize",
    "core:window:allow-start-dragging",
    "core:window:allow-toggle-maximize",
    "core:window:allow-internal-toggle-maximize",
];

fn is_app_page(url: &Url, home: &Url) -> bool {
    url.scheme() == home.scheme()
        && url.host_str() == home.host_str()
        && url.port_or_known_default() == home.port_or_known_default()
}

fn open_outside(app: &AppHandle, url: &Url) {
    if EXTERNAL_SCHEMES.contains(&url.scheme()) {
        let _ = app.opener().open_url(url.as_str(), None::<&str>);
    }
}

// At launch nobody is mid-sale, so a newer signed shell installs at once; Windows restarts into it.
fn install_update_on_launch(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let Ok(updater) = app.updater() else {
            return;
        };
        let Ok(Some(update)) = updater.check().await else {
            return;
        };
        if update.download_and_install(|_, _| {}, || {}).await.is_ok() {
            app.restart();
        }
    });
}

fn main() {
    tauri::Builder::default()
        // A second launch brings the open till forward instead of starting another beside it.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let home: Url = HOME_URL.parse()?;
            let origin = home.origin().ascii_serialization();

            let mut capability = CapabilityBuilder::new("window-controls")
                .remote(format!("{origin}/*"))
                .window(MAIN_WINDOW);
            for permission in WINDOW_PERMISSIONS {
                capability = capability.permission(permission);
            }
            app.add_capability(capability)?;

            let navigation_app = app.handle().clone();
            let new_window_app = app.handle().clone();
            let navigation_home = home.clone();

            WebviewWindowBuilder::new(app.handle(), MAIN_WINDOW, WebviewUrl::External(home))
                .title(WINDOW_TITLE)
                .inner_size(WINDOW_WIDTH, WINDOW_HEIGHT)
                .min_inner_size(MIN_WIDTH, MIN_HEIGHT)
                .maximized(true)
                .decorations(false)
                .on_navigation(move |url| {
                    if is_app_page(url, &navigation_home) || !EXTERNAL_SCHEMES.contains(&url.scheme()) {
                        return true;
                    }
                    open_outside(&navigation_app, url);
                    false
                })
                .on_new_window(move |url, _features| {
                    open_outside(&new_window_app, &url);
                    NewWindowResponse::Deny
                })
                .build()?;

            install_update_on_launch(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to start the Store POS desktop shell");
}
