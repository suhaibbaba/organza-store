# Organza Store — Backend

API for the Organza Store system. Node + Express + TypeScript + Prisma + PostgreSQL.
Auth is [Better Auth](https://www.better-auth.com/), email + password only, admin-driven
(no public sign-up, no self-service password reset).

> **Phase 1 scope:** this project currently only scaffolds the server, the database schema,
> auth, and the dev seed. Products/Variants/Categories CRUD endpoints are not built yet
> (see `spec.md` build order at the repo root).

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ with a role that can create databases (needed by `prisma migrate dev` for
  its shadow database) and the `pg_trgm` extension available (bundled with Postgres, just
  needs to be enabled — the initial migration does this automatically)

## Setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set DATABASE_URL, BETTER_AUTH_SECRET, etc.
```

Create the database (adjust user/db names to match your `.env`):

```bash
sudo -u postgres psql -c "CREATE ROLE organza WITH LOGIN PASSWORD 'organza_dev_pw' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE organza OWNER organza;"
```

Apply migrations (creates all tables, including Better Auth's `user`/`session`/`account`/
`verification` tables, and enables the `pg_trgm` extension used by fuzzy search):

```bash
npx prisma migrate dev
```

Seed dev data (idempotent — safe to re-run any time):

```bash
npx prisma db seed
```

This creates one user per role (all `password123`):

| Email                    | Role     |
|---------------------------|----------|
| admin@organza.test        | ADMIN    |
| manager@organza.test      | MANAGER  |
| employee@organza.test     | EMPLOYEE |

plus global variant types/values, nested categories, and sample products covering every
Phase 1 rule (simple product, single-option, cartesian 2-option, price override, inherited
price/cost, out-of-stock variant, hidden product, soft-deleted product).

## Run

```bash
npm run dev        # tsx watch, http://localhost:4000
npm run build       # compile to dist/
npm start           # run compiled build
```

Health check: `GET /health` → `{ "success": true, "data": { "status": "ok" } }`

Auth endpoints are mounted at `/api/auth/*` (Better Auth's own routes — sign-in, sign-out,
session, etc.). Example:

```bash
curl -X POST http://localhost:4000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@organza.test","password":"password123"}'
```

## Auth notes

- The Better Auth instance lives at `src/lib/auth.ts`. It's configured with
  `emailAndPassword` only — no OTP/passkey (those are deferred, customer-facing, future
  plugins per `spec.md`).
- `User` carries our custom fields (`role`, `phone`, `whatsapp`, `idNumber`, `isActive`) as
  Better Auth `additionalFields`. `role` and `isActive` are `input: false` — they can't be
  set by the sign-up caller, only by server-side/admin code.
- Because sign-up requires `phone` (a required additional field), staff creation always
  goes through `auth.api.signUpEmail({ body: { email, password, name, phone } })` — see
  `prisma/seed.ts`. There's no public registration route; staff accounts are always
  provisioned server-side.
- Password reset is admin-driven (a future admin endpoint using Better Auth's server API),
  never a self-service email flow.
- To regenerate/verify the Better Auth-managed tables against `src/lib/auth.ts` after
  changing its config: `npm run auth:generate` (writes into `prisma/schema.prisma` — review
  the diff, then run `npx prisma migrate dev`).

## Prisma commands

```bash
npx prisma generate      # regenerate the client after a schema change
npx prisma migrate dev   # create + apply a migration
npx prisma studio        # browse the DB
```

## Project layout

```
backend/
├── prisma/
│   ├── schema.prisma   # source of truth for the DB schema
│   ├── migrations/
│   └── seed.ts         # idempotent dev seed
├── src/
│   ├── index.ts         # Express app entry
│   └── lib/
│       ├── auth.ts       # Better Auth instance
│       └── prisma.ts     # shared PrismaClient
├── .env.example
└── package.json
```
