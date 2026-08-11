# Organza Store — Admin

Admin dashboard for the Organza Store system. Next.js (App Router) + TypeScript + Tailwind +
shadcn/ui-style components, talking to the `backend/` API.

> **Phase 1, Part 1 (this build):** app shell only — i18n, auth, role-aware navigation, and
> empty placeholder screens. Products/Inventory/Categories/Users/Settings data screens are
> later parts (see `spec.md` at the repo root).

## Setup

The repo is one npm workspace, so the install happens **once, at the repo root** — it wires up
all four projects against a single lockfile:

```bash
cd ..            # the repo root, if you are in admin/
npm install
cd admin
cp .env.example .env.local
# edit .env.local: NEXT_PUBLIC_API_URL should point at a running backend/ instance
```

That root install also compiles `shared/` into the `@organza/shared` package this app imports
(the shared package's own `prepare` script) — no separate setup step needed, matching `backend/`.

The backend must be running (see `backend/README.md`) with at least the dev seed applied —
this app has no functionality of its own without it.

## Run

```bash
npm run dev         # Turbopack dev server, http://localhost:3000
npm run build        # production build
npm start            # run the production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

## i18n

Locales: `ar` (default), `en`, `he`, routed via a `/[locale]/...` segment (`next-intl`).
Arabic and Hebrew render fully RTL-mirrored (layout, nav, icons, spacing) via the `dir`
attribute on `<html>` — see `src/i18n/` and `src/messages/*.json`. Every UI string goes
through `t()`; there are no hard-coded user-facing strings.

Backend error codes (`error.*` translation keys, e.g. `error.validation.required`) can't be
used as next-intl message paths directly, because some codes are both a leaf message and the
parent of more specific ones (`error.validation` vs. `error.validation.required`), which
nested JSON can't represent. `src/constants/errorMessages.ts` maps each backend code to a
flat, collision-free key under `errors.*` in the message files instead — see
`useTranslateError()`.

## Auth

Login is email + password against the backend's Better Auth endpoints (`/api/auth/sign-in/email`
etc. — not our own `/api/*` envelope). The session's bearer token is stored in `localStorage`
(read by the API client) and mirrored into a plain cookie (read by `src/proxy.ts` for an
optimistic redirect, since Proxy can't read `localStorage`). `AuthGuard` re-verifies the token
against the backend on every load and covers client-side navigations Proxy doesn't re-run for.
`RoleGuard` additionally keeps non-Admins off Admin-only screens (Users, Settings) client-side —
the real gate is always the backend (CLAUDE.md rule 5).

## API client

`src/lib/api/client.ts` is a typed `fetch` wrapper for the backend's own `/api/*` routes: it
attaches the bearer token, unwraps the `{ success, data, meta }` / `{ success, error: { code } }`
envelope, and throws a typed `ApiError` carrying the backend's error code on failure. Pair it
with `@tanstack/react-query` for loading/success/error state and `useTranslateError()` to turn
an error code into display text.

## Charts (Reports)

The Reports screen and the dashboard's Sales & profit block draw with `recharts`. Series
colours live in `globals.css` as `--chart-1..3` (light and dark steps, validated together for
colour-blind separation and for contrast against the card surface) and are read through
`CHART_COLORS` / `CHANNEL_COLORS` in `src/constants/reports.ts`. The order is fixed and
meaning-bearing — slot 1 is always revenue, slot 2 always profit — so a colour never changes
what it stands for between screens, and identity is always carried by a label or legend as
well as by colour. Charts mirror in RTL (`reversed` axes) and every figure that matters is
also written out in text, so nothing depends on reading a bar against an axis on a phone.

Cost and profit are not hidden client-side: the API omits them entirely for roles without
`product.viewCost`, and the components render whatever arrived.

## App icons & which environment this is

`NEXT_PUBLIC_APP_ENV` is either `sandbox` or `production`, and it is the only thing that
tells the two deployments apart — both are built with `next build` and run with
`NODE_ENV=production`, so nothing else can. It is read once, in `src/lib/env.ts`, and it
decides three things:

- **Which icons are served.** `public/app_icon/production/` and `public/app_icon/sandbox/`
  hold the same file names; every icon path is built from the chosen folder in
  `src/constants/pwa.ts`. The sandbox artwork carries an amber `SBX` band.
- **What the installed app is called** — `Organza Admin` or `Organza Admin (SBX)`, so two tiles on the
  same phone can be told apart without opening them.
- **Whether the SANDBOX chip appears** next to the shop's name in the top bar and on the
  login screen (`src/components/layout/environment-badge.tsx`). Production shows nothing.

The value is **inlined at build time**, so changing it means rebuilding, not restarting.
Unset, it means `production` — the safe way round: a live shop whose env file was missed
keeps its own icons and stays unlabelled, rather than telling staff that real orders are
practice data. The backend has the same variable without the prefix (`APP_ENV`), which is
what its destructive-command guards read.

### The files in each folder

| File | Used for |
|---|---|
| `favicon.ico` | Legacy tab icon. A single 16×16. |
| `icon-32.png` | The tab on any current screen, which draws it at 32 real pixels. **Derived.** |
| `icon-180.png` | iOS home screen (`apple-touch-icon`). iOS ignores the manifest entirely. |
| `icon-192.png` | Android launcher icon, and the icon on a pushed notification. |
| `icon-512.png` | Chrome's install prompt and its generated splash. |
| `icon-maskable-512.png` | Android adaptive icon — mark inside the safe zone, so a circular mask can't clip it. |
| `icon-mark-512.png` | The mark on transparency, for the in-app boot splash. **Derived.** |

The two marked **Derived** are generated from `icon-512.png` in the same folder. After
replacing any artwork, regenerate them (needs `backend/`'s dependencies installed, for
`sharp`):

```bash
node shared/scripts/derive-app-icons.js
```

> **Testing new icons on iPhone:** iOS caches a PWA's icon at install time and never
> refetches it. The app has to be removed from the Home Screen and re-added before a new
> icon shows up — a hard refresh in Safari is not enough.

## Project layout

```
admin/
├── src/
│   ├── app/[locale]/       # routes — (app) group is auth-gated, wrapped in the app shell
│   ├── components/         # ui/ (shadcn-style primitives), layout/, auth/, providers/
│   ├── constants/          # nav items, storage keys, API endpoints, error-code → message-key map
│   ├── hooks/
│   ├── i18n/               # next-intl routing/navigation/request config
│   ├── lib/                # api client, auth client, validation schemas, utils
│   ├── messages/           # ar.json / en.json / he.json
│   ├── proxy.ts            # locale routing + optimistic auth redirect (Next.js 16: middleware → proxy)
│   └── types/
├── .env.example
└── package.json
```

Local modules are imported via the `@/` path alias (e.g. `@/lib/api/client`), never relative
paths. The shared cross-app package is a workspace dependency, imported by package name (e.g.
`@organza/shared/constants/errors`), not through an alias — so install from the repo root
(`npm install`) and run this app with `npm run dev -w admin`.

### A note on Next.js 16

This project was scaffolded on Next.js 16, which has some breaking changes versus older
Next.js docs/training data — most relevantly, `middleware.ts` is renamed to `proxy.ts` (see
`src/proxy.ts`) and Turbopack is the default bundler for both `dev` and `build`. See
`AGENTS.md` / `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` before
assuming older Next.js conventions apply.
