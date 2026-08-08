# Organza Store — Backend

API for the Organza Store system. Node + Express + TypeScript + Prisma + PostgreSQL.
Auth is [Better Auth](https://www.better-auth.com/), email + password only, admin-provisioned
(no public sign-up). Staff choose their own passwords from a single-use emailed link — see
[Going live](#going-live).

> **Scope:** Products & Variants CRUD sits on top of the Phase 1 scaffold (server, schema,
> auth), and the Orders API below is Phase 2 part 1 (backend only — the POS and
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

Create the essential data every install needs — the store settings singleton, the global
variant types with a starting set of values, and the expense categories:

```bash
npm run bootstrap
```

Nothing in there is sample data: no products, no orders, no accounts. See
**[Going live](#going-live)** below for the full sequence, and
**[Demo data](#demo-data-dev--sandbox-only)** for the fake catalogue used by the test suite.

## Run

```bash
npm run dev        # tsx watch, http://localhost:4000
npm run build       # compile to dist/
npm start           # run compiled build
```

Health check: `GET /health` → `{ "success": true, "data": { "status": "ok" } }`

Auth endpoints are mounted at `/api/auth/*` (Better Auth's own routes — sign-in, sign-out,
session, etc.). Example, using an account from the demo seed:

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

## Verification suite (`npm run verify`)

One command that proves the system is correct — and prints a pass/fail verdict per **area**
rather than per file, so a money bug is obvious at a glance:

```bash
npm run verify                       # against the sandbox (the default)
npm run verify -- tests/verify        # only the verification suite
API_URL=http://localhost:4000 npm run verify   # against a local API
```

It runs the whole vitest suite — `tests/api/*.test.ts` (per-feature) plus
`tests/verify/*.verify.test.ts` (the money and permissions verification) — against a **live,
already-running, already-seeded API**, then writes a shareable report to
`tests/verify-report.md` and the raw run to `tests/verify-result.json` (both gitignored).

Every assertion names its figure, so a failure reads as a sentence about money:

```
FAIL  2. Discounts & rounding      18 passed, 1 failed
      ✗ Verify · discounts › both levels at once › applies the line discount first
        order total: expected 157.50, got 157.49 (off by -0.01)
```

### The areas

| # | Area | What it proves |
|---|---|---|
| 1 | Pricing | A variant's `priceOverride` applies, an empty one inherits the parent's `basePrice` (and the same for `cost`) resolved at read time, the SKU is frozen at creation, and `compareAtPrice` never changes what is charged. |
| 2 | Discounts & rounding | Percentage and fixed, at line and order level, alone and combined; 2dp HALF-UP rounding with no float drift (3 × 0.10 = 0.30); the server recomputes every total and ignores a tampered one; malformed discounts refused, over-large ones clamped. |
| 3 | Quantities & stock | Whole numbers only; stock leaves the shelf exactly once (STORE at the sale, online at `PREPARING`, guarded by `stockDeductedAt`); overselling refused; stock never negative. |
| 4 | Returns | Partial and full, exact quantities restored, `returnedQuantity` recorded, sales and profit adjusted, nothing returned twice. |
| 5 | Cash drawer | A whole day walked end to end: `expected = opening + cash sales − cash expenses`, a difference recorded with its note and never blocking, a withdrawal subtracted, the remainder carried into the next day, and a counted day never rewritten. |
| 6 | Sold vs received vs owed | The three always reconcile; collecting moves money from owed to received; a bulk settlement takes only what was pending at that moment. |
| 7 | Profit | Gross and net, for all sales and for the received part alone, from the snapshotted `unitPrice`/`unitCost` — re-pricing a product afterwards moves nothing. |
| 8 | Permissions & data exposure | Every role against every sensitive action, enforced on the backend; gated Employee edits held for approval; no endpoint leaking `cost`, `unitCost`, COGS, profit, margin or `idNumber`. |
| 9 | Passwords & go-live | An emailed link works exactly once and dies on time; the public endpoint answers a known and an unknown address identically; the per-address rate limit bites; `init` refuses a database that already has users and writes nothing when it does; a mail provider that cannot deliver never fails the account creation that triggered it; and the guards in front of `seed:demo` and `db:reset` refuse production. |
| 10 | Edge cases | Concurrent sales of the last unit, duplicate SKU, generated EAN-13 uniqueness, a numbered shawl's parent barcode, `+970`/`+972` phone uniqueness. |
| 11 | Platform & API contract | The envelope, pagination, search, categories, images, labels, notifications, version. |

### Safety

The suite is **not read-only**. It creates orders, moves stock, records expenses and opens cash
drawers, so it decides where it is pointed before it sends a single request:

- **The sandbox is the default.** With `API_URL` unset it targets
  `https://api.sandbox.organza-moda.com`.
- **Production is refused**, loudly, with instructions — and so is *any host this suite does not
  recognise*, which is treated as production until told otherwise. To override:

  ```bash
  ORGANZA_ALLOW_PRODUCTION=I-KNOW-THIS-IS-PRODUCTION npm run verify
  ```

  which prints a large warning banner before it starts.
- **Nothing is left behind.** Every product, order and expense the run creates is recorded from
  inside `apiRequest` (`tests/support/fixtureRegistry.ts`) and soft-deleted afterwards, and
  anything left waiting for an Admin is rejected — so the target ends the run in the state it
  started it. Re-running changes no count. `ORGANZA_KEEP_FIXTURES=1` skips the teardown when
  something needs inspecting by hand.
- **A real trading day's cash session is never touched.** A drawer is one per calendar day and
  the API has no way to delete one, so the arithmetic is walked on synthetic dates in 2100+,
  which no sale can fall inside. The one assertion that needs a live window measures the drawer
  **the shop has already opened**, or reports itself skipped. `ORGANZA_ALLOW_TODAY_DRAWER=1`
  lets it open one — only ever appropriate on a disposable database.

`npm run api-test` and `npm run api-test:prod` still exist and run the same vitest suite without
the summary; the production one now needs the override above, like everything else.

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

- **`STORE`** — rung up at the POS counter. Opens `COMPLETED` with stock already deducted and the
  cash already in the till, because the customer walks out with the goods. No customer details
  needed.
- **`WHATSAPP` / `WEBSITE`** — taken remotely. Opens `NEW` and travels
  `NEW → PREPARING → HANDED_TO_COURIER`, committing stock on the move to `PREPARING`.
  `customerName` + `customerPhone` are required.

The two channels end in different places, per spec.md's status flow: an online order finishes at
`HANDED_TO_COURIER` — the shop's involvement ends when the parcel is given to the delivery
company, and it does not track the drive to the customer's door — while `COMPLETED` belongs to a
counter sale, which opens there. There is deliberately no `HANDED_TO_COURIER → COMPLETED` move —
sales and profit reporting should count `FINISHED_ORDER_STATUSES`
(`HANDED_TO_COURIER` + `COMPLETED`) rather than keying off `COMPLETED` alone.

### Payment collection

Selling and being paid are two different moments here, so `Order.paymentStatus`
(`PENDING_COLLECTION` / `COLLECTED`) and `Order.collectedAt` track the money independently of
the status above:

- a `STORE` sale is `COLLECTED` at creation — cash in hand at the till;
- an online order stays `PENDING_COLLECTION` until an Admin/Manager records that the delivery
  company has settled up (`order.markCollected` — an Employee may take the sale but never
  declare its money received);
- a cancelled or fully returned sale owes nothing, so it is excluded from the outstanding view
  and total (`COLLECTABLE_ORDER_STATUSES`).

The outstanding amount is computed from the same per-line view the reports use — net of
returns, cancelled sales excluded — so the orders screen and the reports screen can never quote
different figures for the same sales.

Customers are still deferred as an entity (spec.md) — there is no `Customer` table. Contact
details are snapshotted onto the order: name, phone, optional WhatsApp number, address, and an
optional map pin (`customerLatitude` / `customerLongitude`, WGS84 degrees, both or neither) for
places with no street address.

Any status before the courier handover may go to `CANCELLED` (which puts committed stock back).
A parcel the customer refuses comes back as a return, not a cancellation, so stock and money
move together.
`RETURNED` is reachable only through the returns endpoint, so stock and `returnedQuantity`
always move together. The legal-move table lives in `@shared/constants/order`
(`ORDER_STATUS_TRANSITIONS`) so the backend gate and the frontends' buttons read one source.

Orders are **soft-deleted** (`deletedAt`), like products — a sale is a financial record, so
deleting one hides it from every endpoint instead of destroying it, and puts any stock it still
held back on the shelf.

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
| GET    | `/api/orders`               | Admin/Manager/Employee   | pagination (`page`,`pageSize`), filters (`status`,`channel`,`paymentStatus`,`collectableOnly`,`dateFrom`,`dateTo`,`q`), sort (`sortBy`,`sortDir`) |
| GET    | `/api/orders/collection-summary` | Admin/Manager/Employee | what the delivery company still owes: `{ orderCount, amount, oldestCreatedAt }`, net of returns, across all dates |
| POST   | `/api/orders/collect`       | Admin/Manager            | body `{ orderIds: string[] }` (max 100) — marks a batch collected; already-collected ids are a no-op, an unknown id 404s, a cancelled/returned one 409s |
| GET    | `/api/orders/:id`           | Admin/Manager/Employee   | full detail incl. lines |
| POST   | `/api/orders`               | Admin/Manager/Employee   | `{ channel, items: [{ productId, variantId?, quantity, discount? }], ... }` |
| PATCH  | `/api/orders/:id/status`    | Admin/Manager/Employee   | Employees may advance the flow; `CANCELLED` additionally needs `order.cancel` (Admin/Manager) |
| PATCH  | `/api/orders/:id`           | Admin/Manager            | contact details, note, payment method, order- and item-level discounts (lines are fixed at creation) |
| POST   | `/api/orders/:id/return`    | Admin/Manager            | body `{}` returns the whole order; `{ items: [{ orderItemId, quantity }] }` returns specific lines |
| DELETE | `/api/orders/:id`           | Admin/Manager            | soft delete (`deletedAt`); restores any still-committed stock and hides the order from every endpoint |

Per spec.md's security rationale, an Employee can create an order and hand it to the courier but
can never edit, cancel, return, delete or mark the money collected on one — a sale must not be
erasable to cover theft, and its cash must not be declared received by whoever took it.
`unitCost` is stripped entirely from Employee responses (CLAUDE.md rule 19), and every mutation
writes an audit entry
(`CREATE`/`UPDATE`/`STATUS_CHANGE`/`CANCEL`/`RETURN`/`PAYMENT_COLLECTED`/`DELETE`).

```bash
curl -X POST http://localhost:4000/api/orders \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"channel":"STORE","items":[{"productId":"<id>","quantity":2,
       "discountType":"PERCENT","discountValue":"10"}]}'
```

## Reports (sales & profit)

Both endpoints aggregate in Postgres over the order-line snapshots — no order is ever loaded
into memory — and share one set of rules:

- cancelled and soft-deleted orders are excluded entirely;
- returned quantities come off revenue **and** cost, so a fully returned order nets to zero;
- an order-level discount is apportioned across that order's lines (`total / subtotal`), so
  per-product and per-channel revenue add up to the order's real revenue;
- profit = revenue − cost, both from the line's own `unitPrice` / `unitCost` snapshot, never
  from the product's current values;
- **revenue is what was sold, not what the shop holds.** It is split into `collectedRevenue`
  and `pendingCollectionAmount` (+ `pendingCollectionOrderCount`), which always add back up to
  it, so "we sold 4,000 but 1,500 is still with the delivery company" is answerable. Those
  three are sales figures, not costs, so every role that may read a report sees them.

| Method | Path                          | Role gate               | Notes |
|--------|-------------------------------|--------------------------|-------|
| GET    | `/api/reports/sales-summary`  | Admin/Manager/Employee   | today / this week / this month; `tzOffset` (minutes to add to UTC) puts the period boundaries on the caller's clock |
| GET    | `/api/reports/sales`          | Admin/Manager/Employee   | `from`/`to` are local `YYYY-MM-DD` dates (inclusive), plus `tzOffset` and `topLimit`; returns totals, returns, per-channel split, a trend series and the best sellers |

`cost`, `profit`, `margin` and `missingCostItems` require **`product.viewCost`** (Admin +
Manager). For anyone else those fields are never computed and never appear in the response —
an Employee gets sales counts and revenue only, exactly what the orders list already shows
them. A range longer than a year is rejected (`error.report.range_too_long`), as is a
reversed or malformed one (`error.report.range_invalid`).

```bash
curl "http://localhost:4000/api/reports/sales?from=2026-08-01&to=2026-08-31&tzOffset=180" \
  -H "Authorization: Bearer <token>"
```

## Sale notifications (Web Push)

The shop owner isn't at the counter all day, so a sale rung up by a **Manager** or an
**Employee** is pushed to the **Admins'** devices. Nobody is ever notified of their own sale,
and an Admin's own sale notifies nobody (`SALE_NOTIFICATION_TRIGGER_ROLES` in
`shared/src/constants/push.ts` is the one place that says which roles count).

Transport is the **Web Push standard** — the browser's own push service does the delivery, so
there is no paid notification service. All the server needs is a VAPID key pair, generated
**once per deployment** and kept in its `.env` (never committed; regenerating them invalidates
every subscription already on a phone):

```bash
npx web-push generate-vapid-keys
# -> VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in .env, plus VAPID_SUBJECT (mailto: or https:)
```

With those unset, notifications are simply off: `/api/push/config` reports
`configured: false`, subscribing returns `error.push.not_configured`, and nothing else in the
API behaves differently.

| Method | Path                       | Role gate     | Notes |
|--------|----------------------------|---------------|-------|
| GET    | `/api/push/config`         | any signed-in | `{ configured, publicKey }` — the VAPID public key a browser needs to subscribe |
| GET    | `/api/push/subscriptions`  | any signed-in | the caller's **own** registered devices |
| POST   | `/api/push/subscriptions`  | any signed-in | register this device (upsert on `endpoint`) |
| DELETE | `/api/push/subscriptions`  | any signed-in | unregister it again (body: `{ endpoint }`) |

There is deliberately no permission gate beyond a session: managing your own device isn't a
capability the role table has anything to say about, and every query is scoped to the session's
user. Who *receives* a notification is decided on the sending side
(`src/lib/saleNotifications.ts`), not here.

**Sending never touches the sale.** It runs after the order is committed and its response is on
its way out, is not awaited, and swallows everything into the error-tracking layer
(`src/lib/logger.ts`) — a push service being slow or down can't delay a queue at the till or
turn a completed sale into an error. Dead subscriptions (404/410 from the push service) are
deleted at the moment we learn of them; any other failure keeps the row and only records the
attempt (`lastAttemptAt` / `lastSuccessAt` on the subscription).

**The payload is data, not prose** (CLAUDE.md rule 12): translation keys, the item names in
every language, the total, the currency from the Setting singleton, and who sold it. The
admin's service worker renders that into a line of text in the reader's own language and deep
links to the order.

Which sales are worth a notification is a Setting (Admin only):
`saleNotificationsEnabled`, `saleNotificationMode` and `saleNotificationMinAmount`. Only
`EVERY_SALE` is implemented — `ABOVE_AMOUNT` and `PERIODIC_SUMMARY` exist in the enum so that
adding either is a new branch in `shouldNotifyForSale()` plus an entry in
`IMPLEMENTED_SALE_NOTIFICATION_MODES`, with no migration and no settings redesign. The API
rejects a mode it can't yet honour rather than accepting one that would silently mean "no
notifications".

## Going live

Setting up the shop's real database, in order. Every step is a separate command on purpose:
nothing here happens as a side effect of a deploy, and nothing here creates sample data.

```bash
# 0. only when starting over — DESTRUCTIVE, see below
ORGANZA_DB_RESET_CONFIRM=I-KNOW-THIS-DELETES-EVERYTHING npm run db:reset

# 1. schema
npx prisma migrate deploy

# 2. essential data — settings, variant types, expense categories
npm run bootstrap

# 3. the real staff accounts, ONCE, by hand
npm run init

# 4. …each person opens the email they were sent and chooses their own password

# 5. start entering real products
```

Then sign in at the admin and start adding stock. There is no step where anybody types
somebody else's password.

### The commands

| Command | What it does | Safe to run twice? |
|---|---|---|
| `npm run bootstrap` | Creates the store settings singleton, the three global variant types with a starting set of values, and the five expense categories. Runs on every deploy. | **Yes** — the second run creates nothing. Each item is recorded in `BootstrapRecord` and created at most once in the life of the database, so a colour or an expense category the shop retires stays retired instead of coming back on the next push. A *new* default added in a later release still lands. |
| `npm run init` | Creates the four agreed staff accounts (`src/constants/init.ts`) with **no password**, and emails each of them a single-use "set your password" link. | **Yes, and the second run refuses** — it will not touch a database that already has any user in it. There is no partial mode: adding one more member of staff is the admin's Users screen. |
| `npm run db:reset` | Drops every table, re-applies every migration, and deletes uploaded image files that no longer belong to any product. Seeds nothing. | **Yes** — the second run leaves an empty database empty. It refuses without `ORGANZA_DB_RESET_CONFIRM` typed out in full, every single time, and needs `ORGANZA_ALLOW_PRODUCTION=I-KNOW-THIS-IS-PRODUCTION` on top when `NODE_ENV=production`. |
| `npm run email:preview` | Renders every email in every language to `tmp/email-preview/` (git-ignored). Sends nothing, needs no API key, touches no database. | Yes. |

`init` asks for a phone number per account, because `phone` is required, unique and reaches a
real person (CLAUDE.md rule 18) — it is not something to invent. It offers a name for each
address which you confirm or correct. For a non-interactive run, pass them as flags:

```bash
npm run init -- \
  --name rawandabdelhadi@gmail.com="روان عبد الهادي" \
  --phone rawandabdelhadi@gmail.com=+970599123456 \
  --phone abumajd99.nn@gmail.com=+970599123457 \
  --phone shahdmeflh@gmail.com=+970599123458 \
  --phone jannah2642009@icloud.com=+970599123459
```

### Passwords by email

Nobody is ever handed a password. An account is created with none and its owner chooses one
from a link:

- **`POST /api/password-setup/request`** — public, rate-limited, "email me a link". Answers
  identically whether or not the address belongs to an account.
- **`POST /api/password-setup/verify`** — public, checks a link without consuming it, so the
  screen can say "expired" before anything is typed.
- **`POST /api/password-setup/complete`** — public, redeems the link and sets the password.
  Works exactly once per link, signs every other device out, and marks the email verified.
- **`POST /api/users/:id/password-reset`** — Admin only, sends somebody a fresh link. Returns
  the link too, so it can be passed on by hand when a mailbox is unreachable — an Admin can
  already set any password outright via `PATCH /api/users/:id`, so this hands them nothing new.

The token is 32 random bytes; only its SHA-256 is stored, and it is never written to a log.
A link lasts **72 hours** for a new account and **2 hours** for a forgotten password, and
issuing a new one kills the old one. The `PATCH /api/users/:id` password field stays as the
fallback for a member of staff whose mailbox is unreachable.

Email goes through **Resend** behind a small transport abstraction (`src/lib/email/`) — swap
the provider by adding a file there. Sending happens **after** the write commits and is never
awaited, so a mail provider having a bad afternoon can never turn "the account was created"
into a failure; the failure goes to Sentry instead. With no `RESEND_API_KEY` set, mail is
simply not sent and the API says so in the log.

Configure in `.env` (see `.env.example`): `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`,
`ADMIN_URL`, and `TRUST_PROXY` when the API sits behind the reverse proxy.

## Demo data (dev / sandbox only)

The old `prisma/seed.ts` is now `prisma/dev/demo-seed.ts` and is **quarantined**: it is not
wired to `prisma db seed` (so `prisma migrate dev`/`reset` cannot trigger it), it is not in the
deploy pipeline, and it refuses to run unless told the database is disposable — and refuses
outright when `NODE_ENV=production`, with no override.

```bash
ORGANZA_ALLOW_DEMO_SEED=I-KNOW-THIS-IS-NOT-PRODUCTION npm run seed:demo
```

It creates one user per role (all `password123`) —

| Email                    | Role     |
|---------------------------|----------|
| admin@organza.test        | ADMIN    |
| manager@organza.test      | MANAGER  |
| employee@organza.test     | EMPLOYEE |

— plus nested categories, sample products covering every Phase 1 rule (simple, single-option,
cartesian 2-option, price override, inherited price/cost, out-of-stock variant, hidden and
soft-deleted products, supplier barcodes, a numbered shawl), sample **orders** across every
channel and status, expenses in every state, change requests, and two closed cash-drawer days.

**The API test suite depends on these accounts**, so a sandbox the suite is pointed at has to
have been demo-seeded by hand at least once.

## Auth notes

- The Better Auth instance lives at `src/lib/auth.ts`. It's configured with
  `emailAndPassword` only — no OTP/passkey (those are deferred, customer-facing, future
  plugins per `spec.md`).
- `User` carries our custom fields (`role`, `phone`, `whatsapp`, `idNumber`, `isActive`) as
  Better Auth `additionalFields`. `role` and `isActive` are `input: false` — they can't be
  set by the sign-up caller, only by server-side/admin code.
- Because sign-up requires `phone` (a required additional field), staff creation always
  goes through `auth.api.signUpEmail({ body: { email, password, name, phone } })` — see
  `routes/users.ts` and `scripts/init.ts`. There's no public registration route; staff
  accounts are always provisioned server-side.
- An account created **without** a password has its credential row's `password` set to
  `null`, so there is no secret in the database at all until its owner sets one from an
  emailed link. Sign-in simply fails until then.
- **Password set/reset is by email** (see [Going live](#going-live)) — single-use,
  time-limited links, with the admin-set password on `PATCH /api/users/:id` kept as the
  fallback for an unreachable mailbox.
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
│   ├── schema.prisma       # source of truth for the DB schema
│   ├── migrations/
│   └── dev/
│       └── demo-seed.ts    # QUARANTINED fake catalogue — `npm run seed:demo`, never on deploy
├── scripts/
│   ├── verify.ts           # `npm run verify` — runs the suite, summarises by area, writes the report
│   ├── bootstrap.ts        # `npm run bootstrap` — essential data, runs on every deploy
│   ├── init.ts             # `npm run init` — the real staff accounts, once, by hand
│   ├── db-reset.ts         # `npm run db:reset` — DESTRUCTIVE, manual only
│   └── email-preview.ts    # `npm run email:preview` — render every email without sending
├── tests/
│   ├── api/            # per-feature API suites (against a live API)
│   ├── unit/           # pure logic — token rules, rate limiter, email templates, guards
│   ├── verify/         # the money + permissions verification suite
│   ├── support/        # client, auth, fixtures, money assertions, target guard, teardown
│   ├── constants/      # areas, target hosts, the figures the suite works in
│   └── types/
├── src/
│   ├── index.ts          # Express app entry
│   ├── constants/        # magic strings/numbers (SKU prefix, image sizes, error keys, ...)
│   ├── types/            # centralized types, split by domain, re-exported from types/index.ts
│   ├── lib/               # auth.ts (Better Auth instance), prisma.ts (shared PrismaClient), and other core logic
│   │   └── email/         # the swappable email service: config, transports/, templates/, messages/
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
