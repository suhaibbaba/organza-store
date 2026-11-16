//! The refresh token in the OS secure store: Windows Credential Manager, the Secret Service on
//! Linux, the Keychain on macOS. Only known keys are accepted, so the page cannot read or write
//! anything else there.

use keyring::{Entry, Error};

const SERVICE: &str = "com.organza.desktop";
const ALLOWED: &[&str] = &["refresh-token"];

fn entry(key: &str) -> Result<Entry, String> {
    if !ALLOWED.contains(&key) {
        return Err(format!("unknown secret {key}"));
    }
    Entry::new(SERVICE, key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secret_get(key: String) -> Result<Option<String>, String> {
    match entry(&key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn secret_set(key: String, value: String) -> Result<(), String> {
    entry(&key)?.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secret_delete(key: String) -> Result<(), String> {
    match entry(&key)?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuses_unknown_keys() {
        assert!(entry("anything-else").is_err());
    }
}
