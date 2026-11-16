# Organza

Clothing shop system (back office, POS and orders), Arabic first with English and Hebrew.
See `docs/organza-rebuild-proposal.md` for the design, `docs/progress.md` for where things are.

## Layout

| Path              | What                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `apps/api`        | NestJS 11 on Fastify, Drizzle, PostgreSQL 17. Migrations are plain SQL in `apps/api/drizzle`. |
| `apps/web`        | Vite + React 19 + Mantine single-page app (web, phone PWA and the desktop shell).             |
| `apps/desktop`    | Tauri 2 shell around the web build (Windows now, Linux later).                                |
| `packages/shared` | Zod schemas, money arithmetic, roles and capabilities shared by the API and the app.          |

## Run locally

Requires Node 24, pnpm 12 and Docker.

```sh
pnpm install
cp .env.example .env
pnpm db:up                                   # PostgreSQL 17 on localhost:5433
pnpm --filter @organza/shared build
pnpm --filter @organza/api db:migrate
node --env-file=.env apps/api/dist/database/create-admin-cli.js you@example.com "Your name" "a-long-password"
pnpm --filter @organza/api start             # API on :3000
pnpm --filter @organza/web dev               # app on http://localhost:5173 (proxies /api)
```

`http://localhost:5173/dev/frames.html?path=/` shows any route at phone width (375 px).

## Windows app

`apps/desktop` wraps the web build in Tauri 2. It needs Rust (rustup) and, on Windows, the
WebView2 runtime that ships with Windows 10/11.

```sh
pnpm --filter @organza/desktop tauri:dev     # the app against the Vite dev server
pnpm --filter @organza/desktop tauri:build   # installer in src-tauri/target/release/bundle/nsis
```

The desktop build of the web app reads its API address from `apps/web/.env.desktop`. Inside the
app the refresh token is kept in the OS secure store and receipts go straight to the ESC/POS
printer chosen on **This device** (`/device`). CI builds an unsigned installer on every push
(artifact `organza-windows-installer`). What is left to test on the shop's PC is in
`docs/blocked.md`.

## Checks

```sh
pnpm format:check && pnpm typecheck && pnpm lint && pnpm test
pnpm --filter @organza/web build && pnpm --filter @organza/web check:safari
```

API tests drop and recreate a throwaway `<database>_test` database on every run and boot the
real app against it. CI (`.github/workflows/ci.yml`) runs all of the above and builds both images.

## Rules every change follows

1. Every change to stock or money is a dated row that is never edited (database triggers).
2. A correction is a new row that reverses the old one.
3. Every write happens in one transaction together with its audit entry.
