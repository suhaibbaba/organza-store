# desktop/ — Windows shell for the admin and the POS

A [Tauri](https://tauri.app) window around the **deployed** web apps. It holds no
copy of the admin or the POS: the window opens the live site, so a deploy reaches
it the moment it reaches a browser, and the installers only need rebuilding when
this folder changes.

One Rust binary, two builds. Which app a build is comes from its config overlay:

| | overlay | opens |
|---|---|---|
| Organza Admin | `src-tauri/tauri.admin.conf.json` | `https://admin.organza-moda.com` |
| Organza POS | `src-tauri/tauri.pos.conf.json` | `https://pos.organza-moda.com` |

To point an app somewhere else, change `url` in its overlay.

This is **not** an npm workspace and has no `package.json` — it is a Rust project,
and the Tauri CLI is run through `npx`.

## Building

Windows installers are built by `.github/workflows/desktop-release.yml` on a
Windows runner (a push that touches `desktop/`, or a manual run) and published as
the GitHub release `desktop-v<version>`. Bump `version` in
`src-tauri/tauri.conf.json` for a new release; the same version re-run replaces
the files of the existing one.

By hand, on a Windows machine with Rust and Node:

```
cd desktop
npx @tauri-apps/cli@2 icon ../pos/public/app_icon/production/icon-512.png -o src-tauri/icons/pos
npx @tauri-apps/cli@2 build --config src-tauri/tauri.pos.conf.json
```

## What the shell does, and does not

- Any link that leaves the app (a map, WhatsApp) opens in the default browser.
- Launching it twice focuses the open window instead of starting a second one.
- The page gets **no** access to the machine — no Tauri commands, no
  capabilities. Silent receipt printing or a cash-drawer kick would be added
  here, deliberately, when they are needed.
- Web Push is not available inside WebView2; approval notifications still need
  the browser or the installed PWA.
- The installers are not code-signed, so Windows SmartScreen warns on first run
  ("More info" → "Run anyway").
