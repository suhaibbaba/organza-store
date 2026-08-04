# Organza Store — Backend

API for the Organza Store system. Node + Express + TypeScript + Prisma + PostgreSQL.
Auth is [Better Auth](https://www.better-auth.com/), email + password only, admin-driven
(no public sign-up, no self-service password reset).

> **Scope:** Products & Variants CRUD sits on top of the Phase 1 scaffold (server, schema,
> auth, dev seed), and the Orders API below is Phase 2 part 1 (backend only — the POS and
> admin order screens come next). The customer storefront is still a later phase
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

The response includes a session `token`. Every route below requires it, either as the
`better-auth.session_token` cookie (the default for browser clients) or as
`Authorization: Bearer <token>` (enabled via the `bearer` plugin, handy for curl/Postman):

```bash
curl http://localhost:4000/api/products -H "Authorization: Bearer <token>"
```

## Products & Variants API (Phase 2)

All endpoints return the unified envelope (`{ success, data, meta }` / `{ success: false, error: { code } }`)
and require auth. Errors are translation **keys** (`error.*`), not literal sentences.

| Method | Path                                         | Role gate               | Notes |
|--------|----------------------------------------------|--------------------------|-------|
| GET    | `/api/products`                              | any                      | pagination (`page`,`pageSize`), filters (`categoryId`,`status`,`stock`,`priceMin`,`priceMax`,`q`), sort (`sortBy`,`sortDir`) |
| GET    | `/api/products/:id`                          | any                      | full detail incl. resolved variant price/cost |
| POST   | `/api/products`                              | Admin/Manager/Employee   | `optionSelections` generates cartesian variants |
| PATCH  | `/api/products/:id`                          | Admin/Manager            | isActive change logs PUBLISH/HIDE instead of UPDATE |
| DELETE | `/api/products/:id`                          | Admin/Manager            | soft delete (`deletedAt`) |
| POST   | `/api/products/:id/variants/generate`        | Admin/Manager            | additive — existing combinations are left alone |
| PATCH  | `/api/products/:id/variants/:variantId`      | Admin/Manager            | name/sku/priceOverride/cost/stock/isActive |
| DELETE | `/api/products/:id/variants/:variantId`      | Admin/Manager            | removes one combination |
| GET    | `/api/variant-types`                         | any                      | global types + values, for building option pickers |
| POST   | `/api/variant-types`                         | Admin/Manager/Employee   | inline "add a whole new type" |
| POST   | `/api/variant-types/:id/values`               | Admin/Manager/Employee   | inline "add a value to an existing type" |
| GET    | `/api/categories`                            | any                      | flat list; read-only for now (full nested CRUD is a later stage) |

`cost` (and `resolvedCost`) are only present in responses for Admin/Manager — stripped entirely
for Employee, not just hidden client-side.

## Images API (Phase 2)

Uploads are processed with `sharp` into three WebP sizes (thumbnail/medium/full), stored under
`UPLOAD_DIR` and served statically at `/uploads/*`. Max size and allowed MIME types come from
`UPLOAD_MAX_SIZE_MB` / `ALLOWED_IMAGE_TYPES` in `.env`.

| Method | Path                     | Role gate               | Notes |
|--------|--------------------------|--------------------------|-------|
| POST   | `/api/images`             | Admin/Manager/Employee   | `multipart/form-data`: `file` + exactly one of `productId` / `variantId`. First image for an owner becomes primary automatically. |
| PATCH  | `/api/images/reorder`     | Admin/Manager/Employee   | body `{ productId or variantId, imageIds: string[] }` — sets `sortOrder` from array order; must cover the owner's full image set |
| PATCH  | `/api/images/:id`         | Admin/Manager/Employee   | body `{ isPrimary: boolean }` — setting `true` clears `isPrimary` on the owner's other images |
| DELETE | `/api/images/:id`         | Admin/Manager            | deletion follows product-edit permissions, not the looser "edit images" rule; removes the DB row and all size variants on disk |

```bash
curl -X POST http://localhost:4000/api/images \
  -H "Authorization: Bearer <token>" \
  -F "productId=<id>" \
  -F "file=@dress.jpg;type=image/jpeg"
```

A variant with no images of its own falls back to its parent product's gallery at read time
(`GET /api/products/:id` and audit snapshots resolve this automatically — nothing is copied).

## Orders API (Phase 2)

Two shapes of sale share one model, distinguished by `channel`:

- **`STORE`** — rung up at the POS counter. Opens `COMPLETED` with stock already deducted,
  because the customer walks out with the goods. No customer details needed.
- **`WHATSAPP` / `WEBSITE`** — taken remotely. Opens `NEW` and travels
  `NEW → PREPARING → DELIVERING → RECEIVED → COMPLETED`, committing stock on the move to
  `PREPARING`. `customerName` + `customerPhone` are required.

Any non-terminal status may go to `CANCELLED` (which puts committed stock back).
`RETURNED` is reachable only through the returns endpoint, so stock and `returnedQuantity`
always move together. The legal-move table lives in `@shared/constants/order`
(`ORDER_STATUS_TRANSITIONS`) so the backend gate and the frontends' buttons read one source.

**Money is always computed server-side.** A request names products, quantities and discounts;
`unitPrice`, `lineTotal`, `subtotal` and `total` sent by a client are ignored. Per line:
`lineTotal = unitPrice × quantity − itemDiscount`; then `subtotal = Σ lineTotal` and
`total = subtotal − orderDiscount`. A discount is a `PERCENT` (0–100) or `AMOUNT` pair and is
clamped to what it discounts, so it can never turn into a surcharge.

**Stock is deducted exactly once per order.** `Order.stockDeductedAt` is the single source of
truth — set when stock leaves the shelf, cleared when it all comes back — so re-entering a
state can neither double-deduct nor double-restore. Deduction itself is a guarded atomic
`UPDATE ... WHERE stock >= n`, so two terminals selling the last piece can't both win
(the loser gets `error.order.insufficient_stock`).

Each line snapshots `name`, `variantName`, `sku`, `unitPrice` and `unitCost` at creation, so
renaming or repricing a product later never rewrites a past sale.

| Method | Path                        | Role gate               | Notes |
|--------|-----------------------------|--------------------------|-------|
| GET    | `/api/orders`               | Admin/Manager/Employee   | pagination (`page`,`pageSize`), filters (`status`,`channel`,`dateFrom`,`dateTo`,`q`), sort (`sortBy`,`sortDir`) |
| GET    | `/api/orders/:id`           | Admin/Manager/Employee   | full detail incl. lines |
| POST   | `/api/orders`               | Admin/Manager/Employee   | `{ channel, items: [{ productId, variantId?, quantity, discount? }], ... }` |
| PATCH  | `/api/orders/:id/status`    | Admin/Manager/Employee   | Employees may advance the flow; `CANCELLED` additionally needs `order.cancel` (Admin/Manager) |
| PATCH  | `/api/orders/:id`           | Admin/Manager            | contact details, note, payment method, order- and item-level discounts (lines are fixed at creation) |
| POST   | `/api/orders/:id/return`    | Admin/Manager            | body `{}` returns the whole order; `{ items: [{ orderItemId, quantity }] }` returns specific lines |
| DELETE | `/api/orders/:id`           | Admin/Manager            | restores any still-deducted stock; the audit entry keeps the full record |

Per spec.md's security rationale, an Employee can create an order and mark it delivered but
can never edit, cancel, return or delete one — a sale must not be erasable to cover theft.
`unitCost` is stripped entirely from Employee responses (CLAUDE.md rule 19), and every
mutation writes an audit entry (`CREATE`/`UPDATE`/`STATUS_CHANGE`/`CANCEL`/`RETURN`/`DELETE`).

```bash
curl -X POST http://localhost:4000/api/orders \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"channel":"STORE","items":[{"productId":"<id>","quantity":2,
       "discountType":"PERCENT","discountValue":"10"}]}'
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
│   ├── index.ts          # Express app entry
│   ├── constants/        # magic strings/numbers (SKU prefix, image sizes, error keys, ...)
│   ├── types/            # centralized types, split by domain, re-exported from types/index.ts
│   ├── lib/               # auth.ts (Better Auth instance), prisma.ts (shared PrismaClient), and other core logic
│   ├── middleware/        # asyncHandler, auth, error handling, request validation
│   ├── routes/            # one router per resource
│   └── validation/        # Zod schemas (+ their inferred input types)
├── .env.example
└── package.json
```

Local modules are imported via the `@/` path alias (e.g. `@/lib/auth`), never relative paths;
the shared cross-app package lives in `../shared` and is imported via `@shared/` (e.g.
`@shared/schemas/product`). `npm install` here also installs and builds `shared/` automatically
(see its `postinstall` script) — no separate setup step needed.
