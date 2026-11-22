# Desktop POS (Windows)

A Tauri window around the **deployed** POS. Nothing from `pos/` is compiled in except its icon, so the app
always shows what is deployed; a reinstall is only needed when this shell changes.

- **No title bar.** The window opens maximised with `decorations: false`. The POS draws its own minimise and
  close (`pos/src/components/layout/window-controls.tsx`, shown only inside this app), closing asks first
  because an open cart is lost, and the top bar is the drag area (`data-tauri-drag-region`).
- **The page gets four window actions and nothing else:** close, minimise, drag and maximise, granted at
  start-up to the POS's own origin only (`src/main.rs`). Links to other sites, `tel:`, `mailto:` and WhatsApp
  open outside the app.
- **One till per machine:** a second launch brings the open window forward.
- **Updates itself.** At every launch the shell reads `latest.json` from its channel release
  (`desktop-pos-sandbox` / `desktop-pos-production` on this repo's GitHub releases), and when a newer signed
  version is there it installs it (Windows shows a short progress bar) and reopens. It checks only at launch, so
  a sale is never interrupted. The page itself needs no update: the window always shows the deployed POS.

## Building

Run the **Desktop POS (Windows)** workflow by hand and pick `sandbox` or `production`. Each run is a new version
(`major.minor` from `tauri.conf.json`, the run number as patch), signed and published to that environment's channel
release — the installer first, then `latest.json` — and the run ends by checking what installed apps will be served.
The first install is the `.exe` from that release; after that, apps update themselves.

It needs the repository variables `DESKTOP_POS_URL_SANDBOX` / `DESKTOP_POS_URL_PRODUCTION` (the deployed POS
address), optionally `DESKTOP_POS_NAME`, and the secrets `TAURI_SIGNING_PRIVATE_KEY` +
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, whose public half is `plugins.updater.pubkey` in `tauri.conf.json`. Never
change the key pair: installed apps only accept updates signed by the key they were built with. The sandbox app
installs beside the live one, with its own name, icon and channel.

Locally (needs Rust and the Tauri prerequisites), `npx @tauri-apps/cli@2.12.6 dev` in this folder opens the
POS dev server on `localhost:3001`; set `STORE_DESKTOP_URL` to open another address.
