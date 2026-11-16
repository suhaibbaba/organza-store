# Organza Store — POS

The point-of-sale screen: what the shop uses at the counter to ring up a sale. Next.js (App
Router) + TypeScript + Tailwind + shadcn/ui-style components, talking to the `backend/` API.
Same stack and visual language as `admin/`, tuned for speed on a phone held in one hand.

> **Phase 2, POS Part 1 (this build):** the core selling flow — scan or search, cart with
> quantities and discounts, cash checkout. Order history, returns and the daily till report are
> later parts (see `spec.md` at the repo root).

## Setup

The repo is one npm workspace, so the install happens **once, at the repo root** — it wires up
all four projects against a single lockfile:

```bash
cd ..            # the repo root, if you are in pos/
npm install
cd pos
cp .env.example .env.local
# edit .env.local: NEXT_PUBLIC_API_URL should point at a running backend/ instance
```

That root install also compiles `shared/` into the `@organza/shared` package this app imports
(the shared package's own `prepare` script) — no separate setup step needed, matching `backend/`
and `admin/`.

The backend must be running (see `backend/README.md`) with at least the dev seed applied.
Its `CORS_ORIGINS` must include this app's origin: the browser sends `Origin` on every
cross-origin request, and Better Auth rejects a sign-in whose origin it doesn't trust
(`trustedOrigins` is built from that same variable). `http://localhost:3001` is already in
`backend/.env.example`.

## Run

```bash
npm run dev          # Turbopack dev server, http://localhost:3001 (admin keeps 3000)
npm run build        # production build
npm start            # run the production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

## The selling screen

One screen, `/[locale]/sell`, with three ways to get an item into the cart:

1. **Scan** — the camera button opens `components/sell/scanner/`, which reads the barcode off
   the tag and adds that exact product or variant. **Requires HTTPS** (iOS Safari will not grant
   camera access otherwise); over plain HTTP the scanner says so and points at the fallbacks.
2. **Search** — typing searches the catalogue through the backend's cross-language, typo-tolerant
   search, so "فستن" still finds "فستان سهرة" whatever language the UI is in. Results are
   filtered to active products.
3. **Type a code, or a number** — submitting the search box looks its contents up as a
   barcode/SKU instead of a search term, which is also how a plug-in barcode wedge works (it
   types the code and presses Enter). For a numbered shawl, the variant picker opens with a
   number box: type `4`, press add, and number 4 is in the cart.

The cart carries per-line quantity and discount controls plus an order-level discount, and
checkout creates a `STORE` order: completed immediately, paid in cash, stock deducted
server-side inside the order's transaction.

Money on screen is computed in integer cents by `lib/money.ts`, mirroring the backend's Decimal
rules (2 places, half-up, discounts clamped to what they discount) so the running total always
matches the receipt. The server remains the only authority: the order request carries ids,
quantities and discounts, never a price or a total.

## Roles

Every staff role can sell, Employee included (`spec.md` "Roles & Permissions"). The screen checks
`can(user, "order.create")` from `@organza/shared` to explain itself when an account somehow lacks it —
the real gate is the backend's, on every request (CLAUDE.md rule 5).

## i18n

Locales: `ar` (default), `en`, `he`, routed via a `/[locale]/...` segment (`next-intl`). Arabic
and Hebrew render fully RTL-mirrored (layout, icons, chevrons, spacing) via the `dir` attribute
on `<html>`. Every UI string goes through `t()`; there are no hard-coded user-facing strings.

Backend error codes (`error.*` translation keys) can't be used as next-intl message paths
directly, because some codes are both a leaf message and the parent of more specific ones
(`error.validation` vs. `error.validation.required`). `src/constants/errorMessages.ts` maps each
backend code to a flat key under `errors.*` in the message files instead — see
`useTranslateError()`.

## Auth

Login is email + password against the backend's Better Auth endpoints (`/api/auth/sign-in/email`
etc. — not our own `/api/*` envelope). The session's bearer token is stored in `localStorage`
(read by the API client) and mirrored into a plain cookie (read by `src/proxy.ts` for an
optimistic redirect, since Proxy can't read `localStorage`). `AuthGuard` re-verifies the token
against the backend on every load. The token key differs from the admin app's, so the two can be
open on the same device without signing each other out.

## App icons & which environment this is

`NEXT_PUBLIC_APP_ENV` is either `sandbox` or `production`, and it is the only thing that
tells the two deployments apart — both are built with `next build` and run with
`NODE_ENV=production`, so nothing else can. It is read once, in `src/lib/env.ts`, and it
decides three things:

- **Which icons are served.** `public/app_icon/production/` and `public/app_icon/sandbox/`
  hold the same file names; every icon path is built from the chosen folder in
  `src/constants/pwa.ts`. The sandbox artwork carries an amber `SBX` band.
- **What the installed app is called** — `Organza POS` or `Organza POS (SBX)`, so two tiles on the
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
pos/
├── src/
│   ├── app/[locale]/       # routes — (app) group is auth-gated, wrapped in the app shell
│   ├── components/
│   │   ├── sell/           # the selling screen, incl. sell/scanner/ (the isolated scanner)
│   │   ├── ui/             # shadcn-style primitives
│   │   └── layout/, auth/, providers/
│   ├── constants/          # POS tuning, storage keys, API endpoints, error-code → message-key map
│   ├── hooks/              # cart, scanning/lookup, search, checkout
│   ├── i18n/               # next-intl routing/navigation/request config
│   ├── lib/                # api client, auth client, cart + money maths, numbered-shawl helpers
│   ├── messages/           # ar.json / en.json / he.json
│   ├── proxy.ts            # locale routing + optimistic auth redirect (Next.js 16: middleware → proxy)
│   └── types/
├── .env.example
└── package.json
```

Local modules are imported via the `@/` path alias (e.g. `@/lib/cart`), never relative paths.
The shared cross-app package is a workspace dependency, imported by package name (e.g.
`@organza/shared/constants/order`), not through an alias — so install from the repo root
(`npm install`) and run this app with `npm run dev -w pos`.

### A note on Next.js 16

This project was scaffolded on Next.js 16, which has some breaking changes versus older Next.js
docs/training data — most relevantly, `middleware.ts` is renamed to `proxy.ts` (see
`src/proxy.ts`) and Turbopack is the default bundler for both `dev` and `build`. See `AGENTS.md`
before assuming older Next.js conventions apply.
