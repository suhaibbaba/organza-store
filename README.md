# Organza Store

A custom e-commerce and point-of-sale system for a clothing shop (Organza, Tulkarm branch).
Built from scratch — **not** Medusa, not Shopify, not any e-commerce framework. TypeScript
everywhere, one npm workspace, deployed to the shop's own VPS.

It is used almost entirely on phones, in Arabic, by people who are not tech-savvy, on hardware
as old as an iPhone 7. Most of the unusual decisions in this repo follow from that one sentence.

---

## The four projects

```
organza-store/
├── package.json      workspace root — declares the workspaces, holds the only lockfile
├── shared/           @organza/shared — TypeScript types, Zod schemas, constants, build guards
├── backend/          the API — Node + Express + TypeScript + Prisma + PostgreSQL
├── admin/            the admin dashboard — Next.js
├── pos/              the point-of-sale screen — Next.js
└── frontend/         the customer storefront — Next.js (Phase 3, not built yet)
```

They install as **one npm workspace** against a single root lockfile. `shared/` is a real
dependency of the other three (`@organza/shared`), resolved through `node_modules` like any
package — never copied, symlinked or aliased by hand.

| Project | What it is | Dev port |
|---|---|---|
| `backend/` | REST API, Prisma schema, auth, images, reports, the verification suite | 4000 |
| `admin/` | Products, stock, orders, reports, users, settings, approvals | 3000 |
| `pos/` | The counter: scan or search, cart, discounts, checkout | 3001 |
| `shared/` | Types + Zod schemas both sides agree on, plus the iOS 15 build guards | — |

## Stack

- **Language:** TypeScript, everywhere.
- **Frontends:** Next.js (App Router). Never plain React, never another framework.
- **Database:** PostgreSQL via Prisma. `backend/prisma/schema.prisma` is the source of truth.
- **API:** REST, with one envelope for every endpoint: `{ success, data, meta }` / `{ success, error: { code } }`.
- **Auth:** [Better Auth](https://www.better-auth.com/), email + password only, admin-provisioned — no public sign-up.
- **Money:** Prisma `Decimal`, never `Float`.
- **Images:** stored on the VPS, optimized with `sharp` (WebP, multi-size), displayed with `next/image`.
- **i18n:** `next-intl` for the UI, JSON `{ ar, en, he }` fields for product content. Arabic is the default.
- **Errors:** Sentry, behind a swappable logging layer.

---

## Quick start

Install **once, at the repo root**. That single install wires up all four projects and compiles
`shared/` on the way (its own `prepare` script) — there is no separate build step for it.

```bash
npm install
```

Then bring up the API:

```bash
cp backend/.env.example backend/.env       # set DATABASE_URL, BETTER_AUTH_SECRET, …
sudo -u postgres psql -c "CREATE ROLE organza WITH LOGIN PASSWORD 'organza_dev_pw' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE organza OWNER organza;"

cd backend
npx prisma migrate dev     # all tables + the pg_trgm extension used by fuzzy search
npm run bootstrap          # essential data only — settings, variant types, expense categories
npm run seed:demo          # OPTIONAL: the fake catalogue the API tests depend on (dev only)
```

And the frontends:

```bash
cp admin/.env.example admin/.env.local     # NEXT_PUBLIC_API_URL -> the running backend
cp pos/.env.example   pos/.env.local
```

Run all three in separate terminals:

```bash
npm run dev -w backend     # http://localhost:4000
npm run dev -w admin       # http://localhost:3000
npm run dev -w pos         # http://localhost:3001
```

Each project's own README has the detail — prerequisites, env variables, API surface, layout.

## Commands

Everything is driven from the root with `-w <project>`; running a script from inside a project
directory works too, once the root install has happened.

```bash
npm install                # once, at the root — installs all four, compiles shared/
npm run build              # shared, then backend, admin, pos
npm run typecheck          # every project
npm run lint               # every project

npm run dev -w backend     # or: npm run dev:backend
npm run dev -w admin
npm run dev -w pos

npm run verify -w backend  # the money + permissions verification suite (live API)
npm run api-test           # the API suite against the sandbox
npm run test -w admin      # the admin's own shell/role suite (jsdom, no server)
```

Database work lives in `backend/`:

```bash
npx prisma migrate dev     # create + apply a migration
npx prisma studio          # browse the data
npm run bootstrap          # essential data (idempotent by record, runs on every deploy)
npm run init               # the shop's real staff accounts, once, by hand
npm run db:reset           # DESTRUCTIVE — manual, double-confirmed
```

### Data commands, and which of them a deploy runs

Only one of these is automatic. The rest are typed by a person, on purpose.

| Command | What it creates | When |
|---|---|---|
| `npm run bootstrap` | The Setting singleton, global variant types, expense categories, role permissions — each **once in the life of the database** | Every deploy |
| `npm run seed:demo` | A fake catalogue for development and the API tests | By hand, dev/sandbox only — refuses a database not declared disposable |
| `npm run init` | The shop's real staff, from a git-ignored roster file | By hand, once — refuses a database that already has users |
| `npm run import:prod` | The live catalogue copied into the sandbox, one way | By hand, on the sandbox server only |
| `npm run db:reset` | Nothing — it wipes | By hand, double-confirmed |

## Verification

`npm run verify -w backend` runs the whole suite against a **live, already-seeded API** and
prints a verdict per *area* rather than per file, so a money bug is obvious at a glance:
pricing, discounts and rounding, quantities and stock, returns, the cash drawer, sold vs
received vs owed, profit, permissions and data exposure, passwords and go-live, edge cases,
and the API contract. It writes a shareable report to `backend/tests/verify-report.md`.

The suite is not read-only — it creates orders and moves stock — so it refuses to point at
production. See `backend/README.md` for the guards.

---

## Where things are documented

| File | What it holds |
|---|---|
| **`spec.md`** | The product. Every behavioural rule: products, variants, SKUs, barcodes, search, roles, permissions, approvals, quick sell, orders, the cash drawer, reports. **The answer is usually here.** |
| **`CLAUDE.md`** | The operating manual for working in this repo — the hard rules, the structural conventions, the mobile/RTL/iOS-15 constraints. Read it before making a change. |
| `backend/README.md` | API setup, endpoints, the verification suite, going live, backups, auth notes, layout |
| `admin/README.md` | Admin setup, i18n, auth, API client, app icons, layout |
| `pos/README.md` | POS setup, the selling screen, roles, layout |
| `ops/README.md` | The data that cannot be rebuilt: volumes, backups, restores, the drills |
| `SECURITY-AUDIT.md` | A findings-and-fixes record of the security review |

## Current phase

**Phase 1 — DONE:** products, variants, categories, inventory, users and roles, settings,
images, audit log, and the full admin UI.

**Phase 2 — CURRENT (Orders):** the order model, status flow, stock deduction, discounts and
returns are built, along with the POS selling screen, the admin orders page, and sales/profit
reporting. Also built end to end: the change-approval system, quick sell, the POS product
browser, WhatsApp order entry, and — backend only, no screens yet — the cash drawer, expenses
and gift orders.

**Phase 3 — later:** the customer storefront, real Customer accounts, and the numbered-shawls
WhatsApp export.

---

## The rules worth knowing before you touch anything

The full list is in `CLAUDE.md`. These are the ones that bite hardest:

- **SKU is frozen at creation** (`ORG-<productNumber>[-<variantNumber>]`) and never regenerated.
- **A variant references its option value by ID**, never by copied text, so a rename propagates.
- **A variant's empty price or cost inherits the parent's — resolved at read time**, never copied down.
- **Soft delete only** for products. **Every mutation writes an audit log entry.**
- **Role gating is enforced on the backend**, not hidden in the UI. `cost` and everything derived
  from it (COGS, profit, margin, inventory value) is Admin-only and **absent** from the response
  for everyone else — not zeroed.
- **No hard-coded user-facing text, anywhere.** The backend returns translation *keys*
  (`error.*`), never sentences. A single hard-coded string is a bug.
- **Nobody is handed a password.** Staff accounts are created with none, and their owner sets one
  from a single-use, time-limited emailed link.
- **Phones are stored as entered, in E.164** — never rewritten. Palestine's dual prefix
  (+970/+972) is handled by checking both, not by normalising one into the other.
- **Every permission action is PROTECTED or CONFIGURABLE**, declared beside the action itself.
  The anti-theft guarantees have no row, no endpoint and no screen that can move them.

### And two the browser will not warn you about

- **The oldest phone on the floor runs iOS 15**, and both frontends declare it in their
  browserslist. CSS fails *silently* there — no build error, no console message, perfect on every
  desktop browser — so it is enforced by three build guards wired into `npm run build`:
  `check-messages.js`, then `next build`, then `check-browser-target.js` and
  `check-css-target.js`. Colours are written once in `oklch()` and their sRGB fallback is
  *generated*; never hand-write a second palette, and never put a `var()` inside a colour function.
- **Arabic needs more vertical room than Latin at the same size.** Both apps override the line
  heights for it. Do not put `leading-tight`, `leading-snug` or `leading-none` back on Arabic
  text — the damage only shows where something clips.

## Deployment

GitHub Actions deploys over SSH to the user's own VPS, building on the VPS from its own clone.
Two branches, two stacks, two sets of volumes:

| Branch | Stack | Compose file | API |
|---|---|---|---|
| `sandbox` | `organza-sandbox` | `docker-compose.sandbox.yml` | `api.sandbox.organza-moda.com` |
| `production` | `organza-prod` | `docker-compose.prod.yml` | `api.organza-moda.com` |

All three images are multi-stage and only the last stage ships. `.env` files live on the VPS and
are never committed. The deploy applies migrations and runs `npm run bootstrap` — **never** demo
data, never `init`, never `db:reset`.

Persistent data lives on named volumes at absolute paths the app is told explicitly: the database
and the uploaded photographs are the only two things a deploy cannot rebuild. Renaming a volume
key or the compose `name:` points the stack at a new, empty volume. See `ops/README.md` for
backups, restores and the drills.

No third-party hosting or paid services. Sentry's and Resend's free tiers are the only external
services, and both sit behind a swappable layer.

## When something is unclear

Check `spec.md` first, then `CLAUDE.md`. If the answer is not there, **ask** — never guess at
product behaviour. Guessing is what broke the previous attempt.
