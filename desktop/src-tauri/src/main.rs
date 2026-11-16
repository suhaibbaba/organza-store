// A window around the deployed web app — nothing more. The admin and the POS
// are the same binary; which one a build is comes entirely from the config
// overlay it was built with (tauri.admin.conf.json / tauri.pos.conf.json):
// the name, the icon, the install identity and the URL the window opens.
//
// The page is REMOTE content, so it is given no access to the machine: there
// are no capabilities and no commands. Everything it can do, a browser tab
// could do.

// No console window behind the app on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::webview::{NewWindowResponse, WebviewWindowBuilder};
use tauri::{AppHandle, Manager, Url, WebviewUrl};
use tauri_plugin_opener::OpenerExt;

/// The one window every build has (the `label` in both config overlays).
const MAIN_WINDOW: &str = "main";

/// Schemes that are handed to Windows rather than loaded in the app's window:
/// a map link, a phone number, a WhatsApp chat.
const EXTERNAL_SCHEMES: [&str; 5] = ["http", "https", "mailto", "tel", "whatsapp"];

/// Whether `url` is a page of the app itself — same scheme, host and port as
/// the address the window was configured to open.
fn is_app_page(url: &Url, home: &Url) -> bool {
    url.scheme() == home.scheme()
        && url.host_str() == home.host_str()
        && url.port_or_known_default() == home.port_or_known_default()
}

fn open_outside(app: &AppHandle, url: &Url) {
    if EXTERNAL_SCHEMES.contains(&url.scheme()) {
        // Nothing useful to do if Windows has no handler for it.
        let _ = app.opener().open_url(url.as_str(), None::<&str>);
    }
}

fn main() {
    tauri::Builder::default()
        // Registered first, as the plugin requires. A second launch brings the
        // open window forward instead of starting another till beside it.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // The windows are declared in the config with `create: false` and
            // built here, because the navigation rules below can only be
            // attached to a builder.
            for config in app.config().app.windows.clone() {
                let WebviewUrl::External(home) = config.url.clone() else {
                    return Err(format!("window '{}' must open an https URL", config.label).into());
                };

                let navigation_app = app.handle().clone();
                let new_window_app = app.handle().clone();

                WebviewWindowBuilder::from_config(app.handle(), &config)?
                    // The window only ever shows the app. Any other site opens
                    // in the default browser, so somebody who follows a link
                    // is never stranded in a window with no back button.
                    .on_navigation(move |url| {
                        if is_app_page(url, &home) || !EXTERNAL_SCHEMES.contains(&url.scheme()) {
                            return true;
                        }
                        open_outside(&navigation_app, url);
                        false
                    })
                    // target="_blank" and window.open: never a second, chrome-less
                    // popup — the default browser takes it.
                    .on_new_window(move |url, _features| {
                        open_outside(&new_window_app, &url);
                        NewWindowResponse::Deny
                    })
                    .build()?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to start the Organza desktop shell");
}
