//! Raw printing: the page has already turned the receipt into ESC/POS bytes, so this only has
//! to deliver them untouched. Behind one trait so the Linux till later needs no new screen work.
//!
//! - `tcp://host:port`: a network receipt printer (most listen on port 9100).
//! - any other name: a printer installed in the system, sent as a RAW job (Windows spooler, or
//!   CUPS `lp -o raw` on Linux and macOS).

use std::io::Write;
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

/// Largest job we accept from the page: a long receipt is a few hundred kilobytes.
const MAX_JOB: usize = 4 * 1024 * 1024;

pub trait RawPrinter {
    fn send(&self, data: &[u8]) -> Result<(), String>;
}

#[derive(Debug, PartialEq)]
pub enum Target {
    Network(String),
    System(String),
}

pub fn parse_target(name: &str) -> Result<Target, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("no printer chosen".into());
    }
    if let Some(rest) = name.strip_prefix("tcp://") {
        let addr = if rest.contains(':') {
            rest.to_string()
        } else {
            format!("{rest}:9100")
        };
        return Ok(Target::Network(addr));
    }
    Ok(Target::System(name.to_string()))
}

struct Network(String);

impl RawPrinter for Network {
    fn send(&self, data: &[u8]) -> Result<(), String> {
        let addr = self
            .0
            .to_socket_addrs()
            .map_err(|e| format!("{}: {e}", self.0))?
            .next()
            .ok_or_else(|| format!("{}: no address", self.0))?;
        let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(5))
            .map_err(|e| format!("{}: {e}", self.0))?;
        stream
            .set_write_timeout(Some(Duration::from_secs(10)))
            .map_err(|e| e.to_string())?;
        stream.write_all(data).map_err(|e| e.to_string())?;
        stream.flush().map_err(|e| e.to_string())
    }
}

fn printer_for(target: Target) -> Box<dyn RawPrinter + Send> {
    match target {
        Target::Network(addr) => Box::new(Network(addr)),
        Target::System(name) => Box::new(system::SystemPrinter(name)),
    }
}

#[tauri::command]
pub async fn print_raw(printer: String, data: Vec<u8>) -> Result<(), String> {
    if data.len() > MAX_JOB {
        return Err("print job too large".into());
    }
    let target = parse_target(&printer)?;
    tauri::async_runtime::spawn_blocking(move || printer_for(target).send(&data))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn list_printers() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(system::list)
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(windows)]
mod system {
    use super::RawPrinter;
    use windows::core::{HSTRING, PCWSTR, PWSTR};
    use windows::Win32::Graphics::Printing::{
        ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, OpenPrinterW,
        StartDocPrinterW, StartPagePrinter, WritePrinter, DOC_INFO_1W, PRINTER_ENUM_CONNECTIONS,
        PRINTER_ENUM_LOCAL, PRINTER_HANDLE, PRINTER_INFO_4W,
    };

    pub struct SystemPrinter(pub String);

    /// Closes the printer handle however the job ends.
    struct Handle(PRINTER_HANDLE);
    impl Drop for Handle {
        fn drop(&mut self) {
            unsafe {
                let _ = ClosePrinter(self.0);
            }
        }
    }

    impl RawPrinter for SystemPrinter {
        fn send(&self, data: &[u8]) -> Result<(), String> {
            let name = HSTRING::from(self.0.as_str());
            let doc = HSTRING::from("Organza receipt");
            let datatype = HSTRING::from("RAW");
            unsafe {
                let mut raw = PRINTER_HANDLE::default();
                OpenPrinterW(PCWSTR(name.as_ptr()), &mut raw, None)
                    .map_err(|e| format!("{}: {e}", self.0))?;
                let handle = Handle(raw);
                let info = DOC_INFO_1W {
                    pDocName: PWSTR(doc.as_ptr() as *mut _),
                    pOutputFile: PWSTR::null(),
                    pDatatype: PWSTR(datatype.as_ptr() as *mut _),
                };
                if StartDocPrinterW(handle.0, 1, &info) == 0 {
                    return Err(format!("{}: {}", self.0, windows::core::Error::from_win32()));
                }
                let mut written = 0u32;
                let ok = StartPagePrinter(handle.0).as_bool()
                    && WritePrinter(handle.0, data.as_ptr() as *const _, data.len() as u32, &mut written)
                        .as_bool();
                let _ = EndPagePrinter(handle.0);
                let _ = EndDocPrinter(handle.0);
                if !ok || written as usize != data.len() {
                    return Err(format!("{}: {}", self.0, windows::core::Error::from_win32()));
                }
            }
            Ok(())
        }
    }

    pub fn list() -> Result<Vec<String>, String> {
        let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
        let mut needed = 0u32;
        let mut returned = 0u32;
        unsafe {
            // First call only asks for the size; it "fails" with a too-small buffer.
            let _ = EnumPrintersW(flags, PCWSTR::null(), 4, None, &mut needed, &mut returned);
            if needed == 0 {
                return Ok(vec![]);
            }
            // u64 storage keeps the structures aligned.
            let mut buffer = vec![0u64; (needed as usize).div_ceil(8)];
            let bytes =
                std::slice::from_raw_parts_mut(buffer.as_mut_ptr() as *mut u8, needed as usize);
            EnumPrintersW(flags, PCWSTR::null(), 4, Some(bytes), &mut needed, &mut returned)
                .map_err(|e| e.to_string())?;
            let infos = std::slice::from_raw_parts(
                buffer.as_ptr() as *const PRINTER_INFO_4W,
                returned as usize,
            );
            Ok(infos
                .iter()
                .filter_map(|i| i.pPrinterName.to_string().ok())
                .collect())
        }
    }
}

#[cfg(not(windows))]
mod system {
    use super::RawPrinter;
    use std::io::Write;
    use std::process::{Command, Stdio};

    pub struct SystemPrinter(pub String);

    impl RawPrinter for SystemPrinter {
        fn send(&self, data: &[u8]) -> Result<(), String> {
            let mut child = Command::new("lp")
                .args(["-d", &self.0, "-o", "raw", "-s"])
                .stdin(Stdio::piped())
                .stdout(Stdio::null())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("lp: {e}"))?;
            child
                .stdin
                .take()
                .ok_or("lp: no input")?
                .write_all(data)
                .map_err(|e| e.to_string())?;
            let out = child.wait_with_output().map_err(|e| e.to_string())?;
            if out.status.success() {
                Ok(())
            } else {
                Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
            }
        }
    }

    /// Printer names from CUPS (`lpstat -e`); none when CUPS is missing.
    pub fn list() -> Result<Vec<String>, String> {
        match Command::new("lpstat").arg("-e").output() {
            Ok(out) if out.status.success() => Ok(String::from_utf8_lossy(&out.stdout)
                .lines()
                .map(str::trim)
                .filter(|l| !l.is_empty())
                .map(String::from)
                .collect()),
            _ => Ok(vec![]),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn network_printers_default_to_port_9100() {
        assert_eq!(
            parse_target("tcp://192.168.1.50").unwrap(),
            Target::Network("192.168.1.50:9100".into())
        );
        assert_eq!(
            parse_target("tcp://printer.local:9101").unwrap(),
            Target::Network("printer.local:9101".into())
        );
    }

    #[test]
    fn other_names_are_system_printers() {
        assert_eq!(
            parse_target(" EPSON TM-T20III ").unwrap(),
            Target::System("EPSON TM-T20III".into())
        );
        assert!(parse_target("  ").is_err());
    }

    #[test]
    fn network_printer_receives_the_bytes_untouched() {
        use std::io::Read;
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let reader = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut got = Vec::new();
            socket.read_to_end(&mut got).unwrap();
            got
        });
        let job = vec![0x1b, 0x40, 0x1b, 0x70, 0, 25, 250];
        Network(addr).send(&job).unwrap();
        assert_eq!(reader.join().unwrap(), job);
    }
}
