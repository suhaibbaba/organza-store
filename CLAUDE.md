# CLAUDE.md — Organza Store

Rules for working in this repo. Read this before making any change.
Full product logic lives in `spec.md` — this file is the operating manual.

## What this project is
Custom e-commerce + POS system for a clothing shop. **Not** Medusa or any e-commerce framework.
Build it from scratch with the stack below. If something is ambiguous, check `spec.md`;
if it's still unclear, **ask before assuming** — do not invent product behavior.

## Repo structure (4 separate projects + shared)
```
organza-store/
├── backend/     API — Node + Express + TypeScript + Prisma + PostgreSQL
├── admin/       Admin dashboard — Next.js
├── pos/         Point-of-sale — Next.js
├── frontend/    Customer storefront — Next.js (LATER, not this phase)
└── shared/      Shared TypeScript types + Zod schemas
```
Each project has its own `package.json`. `shared/` is imported by the others.

## Non-negotiable stack choices
- **Language:** TypeScript everywhere.
- **All frontends:** Next.js. Never plain React, never another framework.
- **DB:** PostgreSQL via Prisma. The schema in `backend/prisma/schema.prisma` is the source of truth.
- **API:** REST.
- **Auth:** Better Auth (central backend); login by email + password (phone is contact-only).
- **Money fields:** Prisma `Decimal`, never `Float`.
- **Images:** stored locally on the VPS; optimized with `sharp` (WebP + multi-size) on upload;
  displayed with `next/image`.
- **Barcode/QR:** `html5-qrcode` in the POS, inside an isolated scanner component.
- **i18n:** UI via `next-intl`; product content translated via JSON fields. Languages: ar (default), en, he.

## Scope of the CURRENT phase (Phase 2 — Orders)
Phase 1 is DONE and tested: products, variants, categories, inventory, users/roles, settings,
images, audit log, plus the full admin UI.
**Current work: Orders** (see "Phase 2: Orders" in `spec.md`) — order model, status flow, stock
deduction, discounts, returns, then the POS screen, the admin orders page, and sales/profit.
The **cash drawer, expenses and gift orders** are built on the backend (see "Cash drawer &
expenses" in `spec.md`); their admin/POS screens are not built yet. The **generic change-approval
system** is built end to end (backend + admin screen + nav badge + Web Push) — see rule 21 below
and "Employee change approvals" in `spec.md`; the old per-expense `/approve` and `/reject`
endpoints are gone, lifted into it.
The POS also has a **product browser** — a drawer over the sale with categories on the start side
and a photo grid on the other, for pieces that can't carry a label (see "POS product browser" in
`spec.md`); its favourite categories are flagged from the admin's category screen.
**Still deferred:** the customer storefront (Phase 3), real Customer accounts, and the
numbered-shawls WhatsApp export. WhatsApp order entry is built (admin *and* POS): a cart can be
filed as a WHATSAPP order with a customer snapshot, and the phone box suggests repeat customers
from past orders — there is still no Customer table behind it.

## Hard rules — do not break these
1. **SKU is frozen at creation.** Format `ORG-<productNumber>` (simple) or
   `ORG-<productNumber>-<variantNumber>` (variant). Never regenerate it when category/options change.
2. **Variant → option value is a reference (ID), not copied text.** Renaming a value must
   propagate everywhere automatically.
3. **Variant price/cost fallback:** empty on the variant ⇒ inherit from the parent. Do not copy
   parent values into variants; resolve at read time.
4. **Soft delete only** for products (`deletedAt`). Never hard-delete.
5. **Role gating is enforced on the backend**, not just hidden in the UI:
   - Admin: everything.
   - Manager: products/stock/orders full; no users/settings; cannot approve change requests;
     **no Reports screen** (the dashboard carries their sales figures, minus cost/profit).
   - Employee: POS, add products, edit images, create + mark-delivered orders.
     **Cannot** delete/hide products, **cannot** delete/edit/cancel orders, no users/settings,
     and **no shop-wide money view at all** — no dashboard, no Reports, no outstanding total.
     They see the orders they take, never every order added up.
   Five Employee actions are neither applied nor refused but **held for approval** (rule 21).
6. **Every mutation writes an Audit Log entry** (userId, action, entityType, entityId, old/new).
7. **stock default = 1** for products and variants.
8. **Validate all inputs with Zod** (shared schemas where possible).
9. **Translatable content is JSON** `{ ar, en, he }`. Arabic is the default (configurable),
   missing translations fall back to default. Never make identity/uniqueness depend on
   translated text — use `slug` / `key` for that.
10. **Search is cross-language + normalized + fuzzy.** It must search ALL stored languages
    (not the current UI language), strip Arabic diacritics, unify similar Arabic letters, and be
    typo-tolerant via `pg_trgm`. Build it as an isolated, swappable search layer. Keep each
    Product's `searchText` in sync on every name/description change.
11. **Essential data ≠ demo data.** `npm run bootstrap` (`backend/src/lib/bootstrap.ts`) creates
    the only things a real shop cannot run without — the Setting singleton, the global variant
    types + their default values, the expense categories — each **once in the life of the
    database**, recorded in `BootstrapRecord`. Never re-upsert them: a value the shop deleted
    stays deleted. It runs on every deploy. The **demo seed** is
    `backend/prisma/dev/demo-seed.ts` (`npm run seed:demo`): upsert-based, covers every rule
    (all roles, all product shapes, hidden + soft-deleted samples), its `normalize()` must stay
    in sync with the real search normalizer — and it is **quarantined**: not wired to
    `prisma db seed`, not in CI, and refused unless the run declares the database disposable
    (never under `NODE_ENV=production`). The API test suite depends on its accounts.
    `npm run init` creates the shop's real staff, by hand, once, and refuses a database that
    already has users. **Who** it creates is a git-ignored JSON roster read at run time
    (`staff.json`, or `--accounts`/`ORGANZA_STAFF_FILE`; `staff.example.json` shows the shape) —
    never a list in the source: real people's names, addresses and phone numbers are operational
    data, not code. The whole file is validated before the database is touched, so a bad entry
    can never leave half the accounts created. `npm run db:reset` wipes everything and is
    manual + double-confirmed. `npm run import:prod` copies the **live shop's catalogue into the
    sandbox** — products, categories, variants, images — one way only, wiping the sandbox's own
    catalogue first and never its staff accounts, sessions or settings. It carries nothing
    personal (no orders, users, expenses, cash sessions, approvals or audit history), refuses
    unless the target says `sandbox` in **both** `APP_ENV` and its own database name, makes the
    run name that database out loud, and reads production over a connection that is read-only at
    the server and proven so before a row is read. Terminal only — never a screen in the app.
12. **No hard-coded user-facing text — anywhere.** Every label/message/placeholder/validation goes
    through `t()`. Backend returns translation **keys** (`error.*`), never literal sentences. A
    single hard-coded string is a bug.
13. **Barcodes are auto-generated & unique** (EAN-13), for both products and variants — not the SKU.
    A garment that arrives **already barcoded** may keep the supplier's printed code instead: the
    field is editable (typed or scanned) on create and on edit, per product *and* per variant, and
    which of the two a piece uses is **stored** (`barcodeSource`), never inferred from the code.
    The toggle is reversible — switching back restores the code we minted, so a label already stuck
    on the piece keeps working. Uniqueness is enforced across the whole store (products and
    variants share one namespace). A **parent** may carry one shared supplier code for every
    variant: scanning it in the POS opens the variant picker (the same mechanism as a numbered
    shawl's collection label, `PRODUCT_LOOKUP_KIND.VARIANT_SELECTION`) and a sale on the parent
    alone is refused. Supplier-coded pieces leave the "not printed yet" label queue **by source**
    — never by stamping `labelsPrintedAt`, which would record a print that never happened — and can
    still be printed on request.
14. **Settings drive currency/language/thresholds.** Never hard-code currency symbol, default
    language, or low-stock threshold — read them from the `Setting` singleton.
15. **Unified API envelope** for every endpoint: `{ success, data, meta }` / `{ success, error: { code } }`.
    All list endpoints support pagination + filtering + sorting; never return unbounded lists.
16. **Slug collisions** get a numeric suffix (`name-2`, `name-3`).
17. **Auth: Better Auth** in the central backend (serves admin/pos/storefront). Login by **email +
    password only** (phone is a contact field, NOT a login method); sessions via Better Auth; auth
    tables generated by its CLI (password lives in `Account`, not `User`). Role checks enforced on
    the backend. OTP/passkey are future plugins for customers — don't build them now.
    **Nobody is handed a password:** a staff account is created with none (the credential row's
    `password` is `null`) and its owner sets one from a **single-use, time-limited link emailed to
    them** — see "Passwords: nobody is handed one" in `spec.md`. Only the token's SHA-256 is
    stored; the token is never logged. The public request endpoint is rate-limited and never
    reveals whether an address exists, and unknown/expired/used links all answer with one error
    key. Admin-set passwords (`PATCH /api/users/:id`) remain as the fallback for an unreachable
    mailbox. **A password is always written through Better Auth's own context** —
    `ctx.password.hash` + `ctx.internalAdapter.updatePassword`, in `backend/src/lib/credentials.ts`
    — never a hasher imported on the side and never a hand-picked `Account` row, so what sign-in
    verifies can never drift from what was stored. The users list reports whether an account has a
    password at all (`hasPassword`), so "invited, never signed in" is visible, and re-sending the
    invitation is refused once it has one. Email sending is **after commit and never awaited** — it can never fail the operation
    that triggered it (failures go to Sentry), and it sits behind a swappable provider in
    `backend/src/lib/email/` (Resend today). Email templates live in the codebase and are
    translated through the same per-language message files as everything else.
18. **Phone & WhatsApp stored as-entered in E.164** (never rewrite the prefix, so WhatsApp reaches
    the right number). Both **unique**; phone required, whatsapp optional. Validate format with
    `libphonenumber-js`. **Palestine dual-prefix (+970/+972): enforce uniqueness by checking BOTH
    prefixes** (look up `+970<national>` and `+972<national>`), not by rewriting. Phone is
    contact-only, not a login method. Only format validation (free); ownership OTP is deferred.
19. **Sensitive fields are backend-gated, not just UI-hidden:** `cost` **and everything derived
    from it** (COGS, gross/net profit, margin, inventory value at cost) → **Admin only**;
    `idNumber` → Admin only. The API must not return them to anyone else — not zeroed, absent.
    Separately, a **shop-wide money total is gated on the screen it serves, never on
    `order.view`**: reports → `report.view` (Admin), the dashboard's sales block →
    `dashboard.view` (Admin/Manager), the outstanding total → `order.markCollected`. `order.view`
    is what lets somebody follow the orders they take; it must never add up to the whole shop.
20. **Error tracking via Sentry**, behind an isolated logging layer (swappable for self-hosted
    GlitchTip). Separate from the Audit Log.
21. **One generic change-approval mechanism** (see "Employee change approvals" in `spec.md`).
    Gated Employee actions — product price, manual stock, image deletion, hide/unhide, and a
    product's variant set — file a `ChangeRequest` `(entityType, entityId, field, oldValue,
    newValue)` instead of applying; Admin/Manager edits apply immediately. **Automatic stock
    deduction from a sale is never gated** — a sale always completes. A newer request for the same
    field on the same entity **replaces** the pending one (enforced by the unique `pendingKey`
    column, never by a sweep). Approving applies the change atomically; rejecting discards it;
    both are audited alongside the request itself. Approval is `changeRequest.approve` (Admin
    only, widenable). Never add a second `approvalStatus` column to another table — add an entry
    to `CHANGE_REQUEST_FIELDS` and an applier in `backend/src/lib/changeRequestAppliers.ts`.

## Workflow
- Build **one stage at a time** (see the build order in `spec.md`). Test a stage before the next.
- Run Prisma migrations for any schema change; never edit the DB by hand.
- Keep shared types in `shared/` — don't redefine the Product/Variant shape in each project.
- Prefer small, reviewable changes over large sweeps.

## Commands (fill in real ones as they're set up)
```
# backend
cd backend && npm run dev
npx prisma migrate dev
npx prisma studio

# admin / pos
cd admin && npm run dev
cd pos && npm run dev
```

## Deployment
Hosted on the user's own VPS via GitHub Actions. Do not add third-party hosting/paid services
(Sentry's free tier and Resend's free tier are the only external services, and both sit behind a
swappable layer — GlitchTip for Sentry, another transport in `backend/src/lib/email/transports/`
for Resend). Each app has its own `.env` (see the provided `.env.example` files); `.env` files are
managed on the VPS and never committed. When updating CI, remember there are now **four** projects
(`backend`, `admin`, `pos`, and later `frontend`).

**The deploy creates essential data only** — `npm run bootstrap`. It must never seed demo data,
never create accounts, and never run `init` or `db:reset`. Those three are manual, one-time
commands (rule 11).

**Persistent data lives on named volumes, at absolute paths the app is told explicitly.** The
database (`sandbox_db_data` → `/var/lib/postgresql/data`) and the uploaded photographs
(`sandbox_uploads` → `/app/uploads`, with `UPLOAD_DIR` set in the compose file's `environment:`,
never left to `.env`) are the only things a deploy cannot rebuild. A **relative** `UPLOAD_DIR`
resolves against the container's working directory (`/app/backend`), which is how every uploaded
image was being written into the container layer and lost on each deploy — so any new service or
compose file states its data path absolutely and mounts a volume there. Never rename a volume key
or the compose `name:`: both feed the real volume name, and changing either points the stack at a
new empty volume. See `ops/README.md` for backups — the volumes survive redeploys, not disks.

## When unsure
Check `spec.md` first. If the answer isn't there, ask the user. Never silently guess product
behavior — guessing is what broke the previous attempt.

## Code organization (apply everywhere, backend + frontends)
- **Use path aliases, not relative paths.** Within a project, import local modules with `@/`
  (e.g. `@/lib/auth`, `@/routes/products`) — never `../../lib/auth`. Import the cross-app shared
  package with `@shared/` (e.g. `@shared/types`). Configure both aliases in each project's
  `tsconfig.json` (and the bundler/runtime resolver) so they work at build and runtime.
- **No inline/ad-hoc types scattered across files.** Centralize types in a dedicated `types/`
  directory, split into focused files by domain (e.g. `types/product.ts`, `types/user.ts`,
  `types/common.ts`) and re-export from a barrel (`types/index.ts`). Shared cross-app types live in
  the `shared/` package.
- **All constants live in one place.** No magic strings/numbers inline. Put them under a
  `constants/` directory (e.g. `constants/sku.ts`, `constants/images.ts`, `constants/errors.ts`)
  and import from there. This includes the `ORG-` prefix, image sizes, size/type limits, error
  keys, default page sizes, the +970/+972 prefixes, etc.
- These are **structural rules**: when refactoring to satisfy them, move/rename only — never change
  behavior — and keep `tsc` type-check and the build passing.

## Frontend UX — mobile-first, simple, RTL (admin + pos)
The people using the admin and POS are **not tech-savvy**, and ~**95% of use is on mobile phones**.
Design for that reality:

- **Mobile-first, not merely responsive.** Design and build for a phone screen FIRST, then scale
  up to desktop. Single-column layouts by default; never a desktop layout crammed onto a phone.
- **Big, easy touch targets.** Large tappable buttons (min ~44px), generous spacing, no tiny links
  or dense toolbars. Primary action on each screen should be obvious and reachable by thumb.
- **Few, clear steps.** Minimize taps to complete any task. Avoid multi-step wizards where one
  screen would do. Plain, simple wording — no technical jargon in the UI.
- **Tables become cards on mobile.** Wide data tables must reflow into stacked cards/list items on
  small screens (TanStack Table can drive both). Never force horizontal scrolling of a table on a
  phone.
- **Clear feedback always.** Every action shows loading, success, and error states in plain
  language (mapped from `error.*` keys via `t()`), so an untrained user is never left guessing.
- **RTL must be 100% correct**, not just `dir="rtl"`: the whole layout mirrors (nav, icons, arrows,
  padding/margins, alignment), Arabic uses a clear legible Arabic font, and numbers/dates render
  correctly. **Verify Arabic visually** — do not assume it works. Arabic is the default locale.
- **Accessibility basics:** readable font sizes on mobile, sufficient contrast, labels on inputs.
- **Every password field is a `PasswordInput`** (`components/ui/password-input.tsx`, one per app),
  never a bare `<Input type="password">`. Typing eight unseen characters on a phone keyboard and
  being told only that they were wrong is not something to ask of anyone. It starts hidden always,
  the eye is a 44px button carrying a `t()` label and `aria-pressed`, and it sits at the field's
  **end** (`end-*` / `pe-*`) so it mirrors correctly in Arabic and Hebrew.
- **Never fake a solid icon by putting `fill` on an outline one.** lucide is an outline set; filling
  one floods the body and swallows every inner stroke — a receipt loses its lines, stacked boxes
  merge into a blob. A filled icon must be *drawn* filled, with its detail knocked out as negative
  space (`fill-rule="evenodd"`) or split into separate shapes. The bottom nav's solid twins live in
  `admin/src/components/icons/nav-solid-icons.tsx`, one per `PRIMARY_NAV_KEYS` entry (the table is
  typed so a new tab without a drawn twin fails the build). Check any new one at 24px, light and
  dark — not zoomed.
- Keep the visual language consistent between admin and pos (shared components where sensible).

## Mobile input & device specifics (admin + pos)
- **Numeric fields (stock, quantities, prices) must be easy to type on a phone.** Do NOT use
  `<input type="number">` (it's hard to clear the last digit and accepts junk like `e`/`+`/`-`).
  Use `type="text"` with `inputMode="numeric"` (and `pattern="[0-9]*"` for integers) so the phone
  shows a numeric keypad, plus regex/Zod validation. Stock/quantities are **integers only** (no
  decimals, no negatives). Prices allow decimals but still validate.
- **iOS safe areas:** the app must respect the iPhone home-indicator area. Any fixed **bottom
  navigation/bar** must add `padding-bottom: env(safe-area-inset-bottom)` (e.g. Tailwind
  `pb-[env(safe-area-inset-bottom)]`) so its last part isn't hidden under the indicator on devices
  like iPhone Pro Max. Ensure the viewport meta includes `viewport-fit=cover` (required for safe
  areas to work). Apply the same to any fixed top bar with `safe-area-inset-top` where relevant.

## Admin layout conventions
The admin app uses shared layout primitives (`admin/src/components/layout/`). Use them —
don't hand-roll page chrome:
- **Every admin page is wrapped in `<PageContainer>`** — it provides the max width and page
  padding. Never add page-level padding on top of it (that double-pads).
- **Page titles use `<PageHeader>`** (title, optional description, and page-level actions in
  `actions`) — not an ad-hoc heading block.
- **Summary metrics use `<StatCard>`**, never a bespoke card, so figures look and behave the
  same everywhere.
- **Never use bare `w-full` on a button** — use `w-full sm:w-auto`, so buttons fill the width on
  phones but size to their content on desktop. Exceptions: buttons inside Dialog/Sheet/AlertDialog
  footers, dropdown-menu items, command-palette items and nav items.
- **Segmented controls and tab rows** use `inline-flex w-fit`, not `grid grid-cols-N w-full`.
- **Card grids** scale as `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` rather than being fixed at
  two columns.
- **Use logical CSS utilities only** (`ms-/me-/ps-/pe-`), never `ml-/mr-/pl-/pr-`, so layouts
  mirror correctly in RTL.
- **Desktop layout work must never regress mobile.** The admin is used ~95% on phones: verify
  every change on a phone-sized viewport in Arabic RTL before finishing.

**Note:** these primitives are for `admin/` only. The POS (`pos/`) is a distinct operational
screen with its own layout and is deliberately not converted.
