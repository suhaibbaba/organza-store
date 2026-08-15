# Security audit — Organza Store

**Date:** 2026-08-15
**Scope:** `backend/`, `admin/`, `pos/`, `shared/`, `ops/`, deployment config.
**Method:** full read of all 18 API routers and their permission gates, the shared permission
model, every Zod schema, the money/stock/cash libraries, the auth and password-token layers,
the upload path, all raw SQL, the ops scripts, and a dependency audit. Findings below are
ordered by severity.

Findings are stated as *issue / severity / where / how to reproduce*.

---

## C1 — Anyone on the internet can create a working staff account

**Severity: CRITICAL** · Authentication · `backend/src/lib/auth.ts:22-24`, `backend/src/index.ts:62`

Better Auth is configured with `emailAndPassword: { enabled: true }` and **no
`disableSignUp`**. In Better Auth 1.6, `disableSignUp` defaults to `false`
(`node_modules/better-auth/dist/api/routes/sign-up.mjs:144` — sign-up is refused only when
`!enabled || disableSignUp`), and `autoSignIn` defaults to `true`. The whole Better Auth
surface is mounted publicly:

```ts
app.all("/api/auth/*", toNodeHandler(auth));   // index.ts:62
```

so `POST /api/auth/sign-up/email` is reachable, unauthenticated, from the open internet.

The file's own comment says *"public sign-up stays disabled"* — that sentence describes an
intent that was never expressed in the config.

`role` carries `input: false`, so the attacker cannot pick their role — they get the
`defaultValue`, **`EMPLOYEE`**, and are signed in immediately with a live bearer token. Per
`ROLE_PERMISSIONS`, that is: the entire product catalogue, `order.create` (real sales that
really deduct stock), `order.view` (**every order in the shop, with every customer's name and
phone number**), `order.updateStatus`, `product.create`/`edit`, `images.edit`,
`expense.create`, `changeRequest.create`, and label printing.

**Reproduce**

```bash
curl -X POST https://api.organza-moda.com/api/auth/sign-up/email \
  -H 'content-type: application/json' \
  -d '{"email":"attacker@example.com","password":"hunter2hunter2",
       "name":"x","phone":"+970599000000"}'
# -> 200 { "token": "...", "user": { "role": "EMPLOYEE", ... } }

curl https://api.organza-moda.com/api/orders \
  -H 'Authorization: Bearer <token>'
# -> every order in the shop
```

This is a full unauthenticated foothold into a system that is about to hold real customer
records, real stock and real money. Nothing else in this report matters until it is closed.

---

## H1 — Sign-in rate limiting collapses into one global bucket behind Cloudflare

**Severity: HIGH** · Authentication / availability · `backend/src/lib/auth.ts:33-37`

Better Auth resolves the caller's address with `getIp()`
(`@better-auth/core/dist/utils/ip.mjs`). Its default header list is `["x-forwarded-for"]`, and
with no `advanced.ipAddress.trustedProxies` configured it takes this branch:

```js
if (forwardedIps.length !== 1) return null;   // more than one hop -> give up
```

Behind **Cloudflare → nginx → API** the header arriving at Express carries at least two
entries (Cloudflare appends the client, nginx appends Cloudflare), so `getIp` returns `null`
and the rate-limit key becomes the literal string:

```js
createRateLimitKey("no-trusted-ip", "/sign-in/email")
```

— the **same key for every caller on earth**. The configured limit
(`SIGN_IN_RATE_LIMIT_MAX = 20` per 60s) is therefore not 20 attempts per attacker; it is 20
attempts per minute for the entire shop, shared with the attacker.

Two consequences, the first being the serious one:

1. **Lockout denial of service.** An attacker sending 20 requests a minute — one every three
   seconds, from a single machine — makes every member of staff unable to sign in, for as long
   as they care to keep it up. This shop cannot ring up a sale without the POS.
2. There is no per-attacker limiting on password guessing at all.

**Reproduce** — from any single host, in a loop:

```bash
for i in $(seq 1 25); do
  curl -s -o /dev/null -w '%{http_code} ' \
    -X POST https://api.organza-moda.com/api/auth/sign-in/email \
    -H 'content-type: application/json' \
    -d '{"email":"nobody@example.com","password":"x"}'
done
# ... 429 429 429 — and a real member of staff on a different network is now also 429.
```

---

## H2 — `TRUST_PROXY` is unset everywhere in the repo, and nothing checks it

**Severity: HIGH** · Authentication / availability · `backend/.env.example:60`,
`backend/src/index.ts:45-48`

```ini
TRUST_PROXY=          # .env.example ships it empty
```

```ts
const trustProxy = process.env.TRUST_PROXY?.trim();
if (trustProxy) { app.set("trust proxy", ...) }   // skipped entirely when empty
```

When it is empty, `req.ip` is the reverse proxy's address for **every** caller, so
`callerKey()` returns one constant and the password endpoints' per-IP limiters
(`PASSWORD_RESET_IP_LIMIT = 60`, `PASSWORD_SETUP_REDEEM_LIMIT = 60` per 15 min) all share a
single bucket — the same lockout shape as H1, applied to "email me a link" and "redeem my
link".

Two things make this worse than an ordinary misconfiguration:

- **Nothing anywhere states the correct value.** For the current Cloudflare → nginx → API
  chain it is `2` (assuming nginx uses `$proxy_add_x_forwarded_for`, which is the default
  idiom). The repo says only "the number of proxy hops".
- **It fails silently and invisibly.** The app logs nothing about it, `/health` does not report
  it, and `.env.production` lives on the VPS where this repo cannot see it. There is no way to
  answer "is it right in production?" without shell access — which is exactly how a value that
  was correct for nginx-only stopped being correct when Cloudflare was put in front.

**Reproduce** — with `TRUST_PROXY` unset, from two different networks:

```bash
# machine A, 60 times
curl -s -X POST https://api.organza-moda.com/api/password-setup/request \
  -H 'content-type: application/json' -d '{"email":"a@example.com"}'
# machine B, once
curl -s -X POST https://api.organza-moda.com/api/password-setup/request \
  -H 'content-type: application/json' -d '{"email":"b@example.com"}'
# -> 429 error.rate_limited, despite being a different caller entirely
```

---

## H3 — Known-vulnerable transitive dependencies in the shipped admin/pos images

**Severity: HIGH** · Dependencies · `admin/package.json`, `pos/package.json`

`npm audit`: **7 vulnerabilities (1 critical, 4 high, 2 moderate)**.

| Package | Version | Advisory | Ships in runtime image? |
|---|---|---|---|
| `sharp` (nested under `next`) | 0.34.5 | [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) — libvips CVE-2026-33327/33328/35590/35591 — **high** | **Yes** — Next's image optimizer |
| `postcss` (nested under `next`) | ≤8.5.22 | [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q), [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) — arbitrary file read / path traversal via `sourceMappingURL` — **high** | Build stage |
| `next` | 16.2.12 | pulls both of the above | Yes |
| `vitest` | ≤3.2.5 | [GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp) — arbitrary file read/execute when the UI server listens — **critical** | No (`--omit=dev`, multi-stage) |
| `vite` / `vite-node` / `esbuild` | — | dev-server advisories — high/moderate | No |

The **backend's own** `sharp` is `0.35.3` and is *not* affected — the vulnerable copy is the
one Next installs for its image optimizer, which is enabled and allow-listed to the API origin
in both `admin/next.config.ts` and `pos/next.config.ts`. The `vitest` critical is real but not
exposed: it needs the Vitest UI server listening, and no runtime image contains vitest.

**Reproduce:** `npm audit` at the repo root.

---

## M1 — Zod schemas strip unknown fields instead of rejecting them

**Severity: MEDIUM** · Input validation · all of `backend/src/validation/*.ts`,
`shared/src/schemas/*.ts`

There is not a single `.strict()` in the codebase (36 `z.object` declarations, 0 strict). Zod's
default is `.strip()`, so an unknown key is silently discarded.

**This is not currently exploitable, and I verified that rather than assuming it.** Every route
reads the *parsed* `result.data` (`middleware/validate.ts:13`), no route spreads `req.body`
into a Prisma `data:` (grepped: zero occurrences of `...req.body` / `...body`), and none of the
dangerous fields appears in any schema — `role`, `approvalStatus`, `stockDeductedAt`,
`collectedAt`, `unitPrice`, `subtotal`, `lineTotal`, `total`. All are dropped. The mass
assignment the brief asks about does not work today:

```bash
# all four of these are accepted, and all four fields are silently ignored
curl -X POST .../api/orders -d '{"channel":"STORE","items":[...],"total":"0.01"}'
curl -X POST .../api/expenses -d '{...,"approvalStatus":"APPROVED"}'
curl -X PATCH .../api/orders/<id> -d '{"collectedAt":"2020-01-01"}'
curl -X PATCH .../api/products/<id> -d '{"stockDeductedAt":null}'
```

What it fails is the requirement itself — the brief asks for *rejection* — and the safety
margin. The whole defence rests on nobody ever writing `data: { ...body }`, which is one
plausible refactor away. It also means a client typo (`discountVal` for `discountValue`) is
accepted with a 200 and quietly does nothing.

---

## M2 — Logging out does not reliably end the session

**Severity: MEDIUM** · Authentication · `admin/src/lib/auth/client.ts:53-63`, and the identical
POS copy

```ts
export async function signOut(): Promise<void> {
  const token = getStoredToken();
  clearStoredToken();                    // (1) local token discarded first
  if (!token) return;
  await fetch(..., { method: "POST", headers: { Authorization: `Bearer ${token}` } })
    .catch(() => undefined);             // (2) failure swallowed
}
```

The local token is cleared *before* the server is told, and any failure of that request —
offline, flaky mobile data, a 502 during a deploy — is swallowed. The screen says "signed
out"; the server-side session stays valid for the full `SESSION_EXPIRES_IN_DAYS` (default 7).

On a shop phone shared between shifts, that is a live session that nobody can see and nobody
can revoke, belonging to someone who believes they logged out.

**Reproduce:** sign in, put the device in aeroplane mode, tap "sign out" (the UI returns to the
login screen), then replay the token from before: `curl .../api/orders -H 'Authorization:
Bearer <token>'` → 200.

---

## M3 — `GET /api/settings` returns the whole `Setting` row to every role

**Severity: MEDIUM (latent)** · Data exposure · `backend/src/routes/settings.ts:28-37`

```ts
function serializeSetting(setting: Setting) {
  return { ...setting, saleNotificationMinAmount: formatMoney(...) };
}
```

An unfiltered spread, on a route with `requireAuth` and no permission gate. Nothing in the
model is sensitive **today** (currency, languages, low-stock threshold, label geometry,
notification thresholds), and the route needs to be broadly readable — CLAUDE.md rule 14 makes
these values load-bearing for every screen.

But it is an allow-everything serializer on a table an Admin edits. The next field added to
`Setting` is exposed to every Employee by default, with no code change and no review step. This
is the exact shape of the Reports leak this audit was asked to look for a recurrence of.

---

## L1 — Staff can rewrite their own `idNumber` and phone via Better Auth's own endpoint

**Severity: LOW** · Authorization / data integrity · `backend/src/lib/auth.ts:38-67`

`POST /api/auth/update-user` is part of the mounted Better Auth surface and accepts any
`additionalFields` declared with `input: true`. This config declares three:

```ts
phone:    { required: true,  input: true },
whatsapp: { required: false, input: true },
idNumber: { required: false, input: true },   // <- Admin-only data, rule 19
```

`role` and `isActive` are correctly `input: false`, so **this is not privilege escalation**.
But `idNumber` is Admin-only data (CLAUDE.md rule 19), reachable only through the Admin-gated
`PATCH /api/users/:id` in the app's own API — and any signed-in Employee can set their own to
anything:

```bash
curl -X POST .../api/auth/update-user -H 'Authorization: Bearer <employee>' \
  -H 'content-type: application/json' -d '{"idNumber":"999999999"}'
```

The same path bypasses `assertPhonesAvailable()` and therefore the Palestine dual-prefix
(+970/+972) uniqueness rule in `lib/phone.ts`, so two staff can end up on the same number
written two ways.

## L2 — R2 credentials on the `docker run` command line

**Severity: LOW** · Ops · `ops/common.sh:266-267`

```sh
docker run --rm ... -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
                    -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" ...
```

The secret becomes part of the `docker` client's argv, so it is readable in `/proc/<pid>/cmdline`
by any local user while the backup runs, and it persists in `docker inspect` for the container's
lifetime. Nothing echoes it and no `set -x` is enabled, so it does not reach the logs. On a
single-administrator VPS the practical exposure is small — recorded for completeness.

## L3 — A non-image upload fails as a 500 rather than a 400

**Severity: LOW** · Uploads · `backend/src/routes/images.ts:50-56`, `backend/src/lib/image.ts:68`

The multer `fileFilter` checks `file.mimetype`, which is the **client-declared** Content-Type.
Real content validation happens only implicitly, when `sharp()` throws on a buffer it cannot
decode — and that throw reaches `errorHandler` as an unclassified fault: HTTP 500,
`error.internal`, plus a Sentry event for what is really a bad request.

**The security properties themselves hold**, and are worth stating since the brief asks:

- Nothing but re-encoded WebP is ever written — `storeProductImage` runs every upload through
  `sharp().resize().webp()`, so a PHP script renamed `.png` is not stored, it is decoded (or
  rejected) and re-encoded.
- **No path traversal is possible**: the stored name is `crypto.randomUUID()` and the
  client's filename is never touched.
- Files are not executable — three fixed `-thumbnail/-medium/-full.webp` names under
  `UPLOAD_DIR`, served by `express.static` behind `helmet()`, so `X-Content-Type-Options:
  nosniff` and a default CSP are on every response.
- Size is capped server-side by multer (`UPLOAD_MAX_SIZE_MB`, default 10) before the buffer is
  read.

**Reproduce:** `curl -F 'file=@evil.php;type=image/png' -F 'productId=<id>' .../api/images`
→ 500 `error.internal` (should be 400 `error.image.invalid_type`).

## L4 — Nothing prevents removing the last Admin

**Severity: LOW** · Availability · `backend/src/routes/users.ts:290-331`

`PATCH /api/users/:id` will demote or deactivate the only Admin account. After that nobody can
approve a change request, reach Settings, manage users, or see cost and profit — and there is
no in-app way back; it needs `npm run init` or direct database access.

---

## Checked and found sound

Stated explicitly, because "not mentioned" and "verified" should not look the same.

**Money integrity.** Totals are computed only in `lib/orderPricing.ts`, from the catalogue and
the caller's discounts. No schema anywhere accepts `unitPrice`, `subtotal`, `lineTotal` or
`total` — the comment in `shared/src/schemas/order.ts` naming their absence is accurate.
Discounts are bounded twice: PERCENT is constrained to 0–100 in Zod, and
`resolveDiscountAmount` (`lib/money.ts:45-55`) clamps the resolved amount to the base in both
directions, so a discount can neither exceed the thing it discounts nor become a surcharge. An
edit re-prices lines from their stored snapshots, never from today's catalogue.

**Stock integrity.** `deductStock` (`lib/orderStock.ts:16-30`) is a single atomic statement per
target — `updateMany({ where: { id, stock: { gte: qty } }, data: { decrement } })` — with a
zero-row result raising 409. Two tills cannot both sell the last piece; there is no
read-then-write window. `toStockMovements` collapses duplicate lines so one order cannot
oversell itself, and `stockDeductedAt` is the single source of truth for whether an order holds
stock, so re-entering a status can neither double-deduct nor double-restore.

**Returns.** Bounded twice — per entry against `quantity - returnedQuantity`, then again on the
summed-per-line map, so two entries for the same line cannot add up past what was sold
(`routes/orders.ts:592-618`).

**Cash sessions.** Closing a closed drawer is a 409. The figures are computed at close and
frozen onto the row, so a return processed next week cannot rewrite a signed-off day
(`routes/cashSessions.ts:242-320`).

**Cost / profit gating.** `product.viewCost` is a single Admin-only gate, and the fields are
**omitted rather than zeroed** in all three serializers — `lib/pricing.ts` (product `cost`,
variant `cost`/`resolvedCost`), `lib/orderSerialize.ts` (`unitCost`), `lib/reports.ts` (`cost`,
`profit`, `margin`, and the whole `profit` block). Screen-level money totals are gated on the
screen they serve, matching spec.md exactly: reports `report.view` (Admin), dashboard sales
`dashboard.view` (Admin/Manager), outstanding total `order.markCollected`. The dashboard's
inventory valuation switches its basis to price for a Manager rather than leaking a cost
figure. `idNumber` is only serialized inside the Admin-gated users router. I found no path by
which a Manager or Employee receives a cost-derived figure.

**Object-level access.** Change requests are narrowed to the requester unless the caller holds
`changeRequest.approve` — on the list, the count *and* the detail route (`routes/changeRequests.ts:70,116,131`);
cancel is requester-only with no Admin override. Push subscriptions take `userId` from the
session on every query, never from the body. Variant and order-item lookups are scoped to their
parent's id, so a guessed id from another product resolves to 404.

**SQL injection.** Every `$queryRaw` is a tagged template with real parameters (search,
reports, cash, expenses, collection). The two `$executeRawUnsafe` calls
(`lib/productionImport/apply.ts:122,129`) interpolate only compile-time constants from
`constants/`, never request data. `queryTopSellers`' dynamic `ORDER BY` is a `Prisma.sql`
fragment chosen from a validated enum.

**Password links.** 32 random bytes; only the SHA-256 is stored; constant-time compare; TTL per
purpose (SET 72h, RESET 2h); single-use enforced by a *conditional* `markUsed` write, so two
racing redemptions have exactly one winner; issuing revokes all prior links; redeeming revokes
every session and every other link. The token travels in a request body throughout, never in a
URL or a log. Password hashing goes through Better Auth's own context in `lib/credentials.ts`
(`ctx.password.hash` + `internalAdapter.updatePassword`), so what sign-in verifies cannot drift
from what was written. Minimum length is enforced in Zod at both entry points.

**User enumeration.** `POST /api/password-setup/request` returns the identical
`{ requested: true }` for a known address, an unknown one and a deactivated account, and is
limited per-address (3 / 15 min) as well as per-caller.

**CORS and headers.** `helmet()` with defaults; CORS restricted to an explicit
`CORS_ORIGINS` allow-list with `credentials: true` and no wildcard, and it fails closed when
unset. `trustedOrigins` on Better Auth is fed from the same list.

**Error responses.** No stack traces or internal details escape: everything unrecognised
collapses to `error.internal` with a translation key, and the detail only ever carries Zod
issues about the caller's own input (`middleware/errorHandler.ts`).

**Secrets.** No secret is logged or returned anywhere. No `NEXT_PUBLIC_*` variable carries one
(`API_URL`, `APP_ENV`, `APP_VERSION`, `BUILD_ID`, locales, project name, Sentry DSN — a DSN is
public by design). The session token cookie mirror carries `Secure` (on https) and
`SameSite=Lax`.

---

## Note on `order.view` and the orders list

An Employee holding `order.view` can page through **every** order in the shop and read each
one's total, customer name and phone. I checked this against spec.md rather than assuming, and
it is deliberate: the roles table grants "Create order + hand to courier" to Employees, and the
security rationale draws the line at *aggregates* — "Reading one order is not reading every
order added up", which is why reports, the dashboard and the outstanding total each got their
own permission. The list is not an aggregate and no total is computed across it.

Recording it as an observation, not a defect: if the shop would rather an Employee saw only the
orders they took, that is a `where.createdById` on the list route and a change to spec.md — a
product decision, not a bug fix, so I have not made it.

---

---

# Fixes

Applied in severity order. Every one is covered by a test that fails without it —
`backend/tests/api/security.test.ts` (23) and `backend/tests/unit/proxyTrust.test.ts` (10).

### C1 — public sign-up

`emailAndPassword.disableSignUp: true` in `backend/src/lib/auth.ts`. That alone would have
broken the Admin's own "create staff" button, because it went through the same endpoint — so
account creation moved to a new `createStaffUser()` in `backend/src/lib/credentials.ts`, which
writes through Better Auth's own internal adapter (the same one its sign-up handler uses). All
three creation paths now go through it: `POST /api/users`, `npm run init`, and the demo seed.

Two things improved on the way past:

- **No throwaway password is ever minted.** The old path had to invent one, hash it, store it
  and then null it out, so a working credential for a brand-new account existed in the database
  for the width of two writes. Now an account with no password simply has no credential row.
- The duplicate-email check compares against the **normalized** address, which is what sign-in
  looks up by. `Sara@…` used to slip past a stored `sara@…` and then fail at the unique
  constraint, surfacing as `error.auth.signup_failed`.

### H1 — sign-in rate limiting

`advanced.ipAddress.trustedProxies` on the Better Auth instance, fed from a new
`TRUSTED_PROXY_IPS`. Better Auth parses the forwarded chain itself and never sees express's
`trust proxy`, which is why setting only `TRUST_PROXY` left this half broken.

### H2 — proxy trust

Both settings now live in one file, `backend/src/lib/proxyTrust.ts`, which **says what it
believes on every start** — one line next to the uploads path, and a paragraph plus a Sentry
event when a deployed build has been told nothing. `isProxyTrustConfigured()` requires **both**
values: half-configured is the trap, because setting `TRUST_PROXY` alone fixes the visible half
and leaves the sign-in limit shared with the internet. `.env.example`, `backend/README.md` and
both compose files now state the value for the current chain (`TRUST_PROXY=2`) and why.

### H3 — dependencies

`next` 16.2.12 → **16.3.1** (drops the vulnerable nested `sharp` and `postcss`), `vitest`
`^2.1.8` → **`^3.2.7`** (patched; 3.2.7 rather than the 4.x `audit fix --force` suggests, which
is two majors). `npm audit`: **0 vulnerabilities**. Both frontends build and the whole suite
runs on the new vitest.

### M1 — unknown fields

One check in `validateBody` (`backend/src/middleware/validate.ts`) rather than `.strict()` on
thirty-odd schemas: it compares the raw body against the parsed one, and anything Zod stripped
is a 400 `error.validation` naming the path — including nested ones (`items.0.unitPrice`). Done
in the middleware because it cannot be forgotten on the next schema, and because `.strict()` has
to be applied to a ZodObject *before* `.refine()` wraps it, which most of these schemas do.

Query strings are deliberately left stripping: they collect cache-busters and link trackers that
are nobody's attempt to set anything, and no write on this API reads a value from the query.

**This changed five existing tests**, which asserted the old contract — that a tampered `total`,
`approvalStatus` or `key` was *ignored*. They now assert refusal, and each keeps a second
assertion that the server-computed value is still correct, so the guarantee underneath is still
covered rather than replaced.

### M2 — logout

`signOut()` in both `admin/` and `pos/` now awaits the server, returns whether the session was
actually revoked, and clears the local token in `finally` (so nobody is ever stranded on a device
they cannot sign out of). A test proves the server side: a signed-out token replays as 401.

### M3 — settings payload

`serializeSetting` names its fields instead of spreading the row, and a test asserts **set
equality** on the key list for all three roles — so a new column reaching every Employee fails
the build rather than shipping.

### L1 — self-service profile fields

`idNumber`, `phone` and `whatsapp` are now `input: false` on the Better Auth user model, so
`POST /api/auth/update-user` cannot write them. All three are written by the Admin-gated
`routes/users.ts` and at creation by `createStaffUser`, neither of which goes through `input`.

### L2 — R2 credentials

`ops/common.sh` passes them via `--env-file` (mode 600, `trap … RETURN`) instead of `-e KEY=value`,
so they no longer appear in the `docker` client's argv or in `docker inspect`.

### L3 — non-image uploads

`storeProductImage` asks sharp for metadata first and raises a 400 `error.image.invalid_type`.
A PHP script announced as `image/png` is now a bad request rather than a 500 with a Sentry event.

### L4 — the last Admin

`assertNotLastAdmin` in `routes/users.ts` refuses the demotion or deactivation that would leave
no active Admin — 409 `error.user.last_admin`, translated in all three languages.

---

## Verification, and its limits

**What ran:** the full suite, 42 files / **547 passing**, plus `npm run typecheck` across all
four projects and `npm run build` (including both Next apps on the upgraded version).

**Where it ran, and why not the sandbox.** `npm run api-test` hard-codes
`API_URL=https://api.sandbox.organza-moda.com`, and this session's egress policy refuses that
host outright — 403 on CONNECT, confirmed against the proxy's own status endpoint. So the suite
was run against a **local** PostgreSQL 16 + backend built from this branch (migrated,
bootstrapped and demo-seeded), which `tests/support/target.ts` classifies as a `local` target and
allows by design. That is the same suite by the same runner; only the target differs.

**This means `npm run api-test` as written has not been executed against the sandbox**, and it
should be, from somewhere that can reach it, before this is deployed. Nothing here depends on
sandbox-only data, so I expect it to pass — but expecting is not the same as having seen it, and
the difference is worth stating plainly.

The C1 exploit was confirmed working against that local instance before the fix (anonymous
sign-up returned a bearer token; the token then read every order) and confirmed refused after.
