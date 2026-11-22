fn main() {
    // The window's address is compiled in, so a change to it must rebuild.
    println!("cargo:rerun-if-env-changed=STORE_DESKTOP_URL");
    tauri_build::build()
}
