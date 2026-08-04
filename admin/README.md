# Organza Store — Admin

Admin dashboard for the Organza Store system. Next.js (App Router) + TypeScript + Tailwind +
shadcn/ui-style components, talking to the `backend/` API.

> **Phase 1, Part 1 (this build):** app shell only — i18n, auth, role-aware navigation, and
> empty placeholder screens. Products/Inventory/Categories/Users/Settings data screens are
> later parts (see `spec.md` at the repo root).

## Setup

```bash
cd admin
npm install
cp .env.example .env.local
# edit .env.local: NEXT_PUBLIC_API_URL should point at a running backend/ instance
```

`npm install` also builds `shared/` and symlinks it into `node_modules/@shared` (see the
`postinstall` script) — no separate setup step needed, matching `backend/`.

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
paths; the shared cross-app package is imported via `@shared/` (e.g. `@shared/constants/errors`).

### A note on Next.js 16

This project was scaffolded on Next.js 16, which has some breaking changes versus older
Next.js docs/training data — most relevantly, `middleware.ts` is renamed to `proxy.ts` (see
`src/proxy.ts`) and Turbopack is the default bundler for both `dev` and `build`. See
`AGENTS.md` / `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` before
assuming older Next.js conventions apply.
