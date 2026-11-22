# CLAUDE.md — Store Management

Rules for working in this repo. Read this before making any change.
Full product logic lives in `spec.md` — this file is the operating manual.

## What this project is

Custom e-commerce + POS system for clothing shops, run by each shop as a client. **Not** Medusa or any e-commerce framework.
Build it from scratch with the stack below. If something is ambiguous, check `spec.md`;
if it's still unclear, **ask before assuming** — do not invent product behavior.

## Repo structure (4 separate projects + shared, one npm workspace)

```
store-management/
├── package.json      workspace root — declares the workspaces, holds the only lockfile
├── backend/     API — Node + Express + TypeScript + Prisma + PostgreSQL
├── admin/       Admin dashboard — Next.js
├── pos/         Point-of-sale — Next.js
├── frontend/    Customer storefront — Next.js (LATER, not this phase)
├── shared/      Shared TypeScript types + Zod schemas — published as @store/shared
└── ui/          Store Management's design system — published as @store/ui (TypeScript source)
```

The system is **Store Management**; each shop that runs it is a **client**, and nothing in the code
names one — the shop's name, logo and favicon are Settings data.
`@store/ui` is its design system (ported from the clinic system's `@clinic/ui`). Client looks are
themes inside it — today `ui/src/themes/teal.css` + `teal.ts`, applied by `UiProvider` — never
edits to the components. The admin's `/design-system` page (Admin role only) shows every component.
The apps' base stylesheet is `ui/src/styles/app.css` (type scale, safe areas, app-like touch rules,
boot splash), imported by admin and POS alike; each app's `globals.css` holds only what is its own
(admin: page container, label printing; POS: selling-screen breakpoints, touch targets, scan animations).

Each project has its own `package.json`, and the root one ties them together as **npm
workspaces**. There is exactly one `package-lock.json`, at the root; per-project lockfiles must
never come back. `shared/` is a real dependency of the others (`@store/shared`), resolved
through `node_modules` like any package — not copied, symlinked or aliased by hand. A new project
(`frontend/`) has to be added to the root `workspaces` array to exist.

## Non-negotiable stack choices

- **Language:** TypeScript everywhere.
- **All frontends:** Next.js. Never plain React, never another framework.
- **DB:** PostgreSQL via Prisma. The schema in `backend/prisma/schema.prisma` is the source of truth.
- **API:** REST.
- **Auth:** Better Auth (central backend); login by email + password (phone is contact-only).
- **Money fields:** Prisma `Decimal`, never `Float`.
- **Images:** stored locally on the VPS; optimized with `sharp` (WebP + multi-size) on upload;
  displayed with `next/image`. The shop frames the garment itself in the admin's editor
  (`react-easy-crop`, 2:3 by default) and what travels is the **crop rectangle, turn and mirror** —
  never a canvas re-encode — so sharp cuts every size from the **original**, which is kept so a
  different crop can be made later. See "Editing a photograph on upload" in `spec.md`.
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
**Quick sell** is built end to end (POS + admin): a piece that isn't in the catalogue can be sold by
typing a name and a price, and the deliberately-incomplete product it creates is reviewed
afterwards through the same change-request mechanism — see "Quick sell" in `spec.md` and rule 23.
The POS selling screen is laid out from the Figma design — category tiles with product counts, a
photo grid, and the cart as a side panel from 1000px or a bottom bar + sheet below it (see "POS
selling screen layout" in `spec.md`); its favourite categories are flagged from the admin's
category screen.
**Customers and selling on credit** are built end to end (backend + admin + POS): a `Customer`
table (phone unique under both +970/+972), credit sales on any channel (counter or WhatsApp) with any number of payments, per-piece
handover for pieces kept in the shop — see "Customers and selling on credit" in `spec.md`.
**Suppliers** are built (backend + admin): suppliers, their invoices as amounts owed (not stock),
and payments against one invoice or oldest first, each marked as from the till or not — see
"Suppliers and their invoices" in `spec.md`.
**Still deferred:** the customer storefront (Phase 3), customer LOGIN accounts, and the
numbered-shawls WhatsApp export. WhatsApp order entry is built (admin _and_ POS): a cart can be
filed as a WHATSAPP order with a customer snapshot, and the phone box suggests repeat customers
from past orders; the order is also linked to its `Customer` row, created on first order.

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
     That table is the shop's **starting point**: every Manager/Employee grant is editable per shop
     from the admin's Permissions screen; the Admin role never is — see rule 22.
6. **Every mutation writes an Audit Log entry** (userId, action, entityType, entityId, old/new).
7. **stock default = 1** for products and variants.
8. **Validate all inputs with Zod** (shared schemas where possible).
9. **Translatable content is JSON** `{ ar, en, he }`. Arabic is the default (configurable),
   missing translations fall back to default. Never make identity/uniqueness depend on
   translated text — use `slug` / `key` for that.
10. **Search is cross-language + normalized + fuzzy.** It must search ALL stored languages
    (not the current UI language), strip Arabic diacritics, unify similar Arabic letters, and be
    typo-tolerant. The engine is a **self-hosted Meilisearch** (its own compose service and
    volume), reached only through the isolated layer in `backend/src/lib/search/` — callers use
    `searchProductIds` and `indexProducts`, never an engine. **`pg_trgm` is the fallback**: no
    `MEILI_HOST`, or Meilisearch down or erroring, and search answers from Postgres, so the till
    never loses search. Our own `normalize()` (diacritics, tatweel, similar letters) runs on both
    the indexed text and the query, and each word is also indexed without the article ال and an
    attached و/ب/ل. **Every index setting and the synonyms list live in one versioned file,
    `backend/src/constants/searchIndex.ts`**, applied by `npm run search:setup` and by every
    reindex — never set by hand. A search on a list's default sort comes back **closest match
    first** (`lib/search/relevance.ts`); every other filter still runs in Postgres. Keep each
    Product's `searchText` in sync on every name/description change, and after the commit of
    anything that changes a product's document (name, codes, category, variants, price, stock,
    visibility, image) call **`indexProducts`** (awaited ≤2s, so a save is searchable on return)
    or **`queueProductSync` / `queueOwnerSync` / `queueCategorySync`** (batched, returns at once).
    None of them throw, so search can never fail a save. The index is rebuildable:
    `npm run search:reindex` rebuilds it from the database on every deploy, and the import and
    demo seed rebuild it too.
11. **Essential data ≠ demo data.** `npm run bootstrap` (`backend/src/lib/bootstrap.ts`) creates
    the only things a real shop cannot run without — the Setting singleton, the global variant
    types + their default values, the expense categories, and the configurable role permissions
    (rule 22) — each **once in the life of the database**, recorded in `BootstrapRecord`. Never
    re-upsert them: a value the shop deleted stays deleted. It runs on every deploy. The **demo seed** is
    `backend/prisma/dev/demo-seed.ts` (`npm run seed:demo`): upsert-based, covers every rule
    (all roles, all product shapes, hidden + soft-deleted samples), its `normalize()` must stay
    in sync with the real search normalizer — and it is **quarantined**: not wired to
    `prisma db seed`, not in CI, and refused unless the run declares the database disposable
    (never under `NODE_ENV=production`). The API test suite depends on its accounts.
    `npm run init` creates the shop's real staff, by hand, once, and refuses a database that
    already has users. **Who** it creates is a git-ignored JSON roster read at run time
    (`staff.json`, or `--accounts`/`STORE_STAFF_FILE`; `staff.example.json` shows the shape) —
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
    field is editable (typed or scanned) on create and on edit, per product _and_ per variant, and
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
    password**, or a passkey the person added (phone is a contact field, NOT a login method); sessions via Better Auth; auth
    tables generated by its CLI (password lives in `Account`, not `User`). Role checks enforced on
    the backend. OTP is a future plugin for customers — don't build it now.
    **Staff may also sign in with a passkey** they added on My profile (Better Auth's passkey
    plugin) — an addition to the password, never a replacement. One passkey serves admin and POS:
    it belongs to the apps' shared domain, derived from `CORS_ORIGINS` (`PASSKEY_RP_ID` overrides),
    and on the POS it joins the tablet like a password sign-in. See "Passkeys" in `spec.md`.
    **The POS also unlocks with a 6-digit passcode** — never a way to sign in on a new device: a
    password sign-in joins the tablet, the passcode only reopens it, the server checks every try
    (5 wrong → password only on that tablet), and the till auto-locks after
    `Setting.posAutoLockMinutes`. See "POS passcode and lock" in `spec.md`.
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
    only as shipped, configurable). Never add a second `approvalStatus` column to another table — add an entry
    to `CHANGE_REQUEST_FIELDS` and an applier in `backend/src/lib/changeRequestAppliers.ts`.
22. **Every permission action is CONFIGURABLE for the Manager and the Employee; the ADMIN role
    never is** (see "Editable role permissions" in `spec.md`). The actions are declared in
    `shared/src/constants/permissions.ts`, split into `PROTECTED_ACTIONS` (answered by `can()` from
    the shipped table only — **empty today**, kept so an action can be re-locked with one entry) and
    `CONFIGURABLE_ACTIONS` (the rest — today, all of them, cost/profit, reports, re-pricing, order
    edit/cancel/delete/return, gifts, collecting money, approvals, staff and permissions
    included). What keeps the shop from being locked out is the **Admin role** (`FIXED_ROLE`):
    an Admin holds every action always, `can()` ignores any stored row for it, and the API refuses
    any edit to the ADMIN row by anybody (`error.permission.admin_role`) — even a Manager handed
    `permission.manage`. Nobody edits their own role, and the last active Admin cannot be demoted.
    Grants live one row per (role, action) in `RolePermission`, seeded from today's exact defaults
    by `npm run bootstrap` (rule 11), with a MISSING row meaning "as shipped" rather than "no".
    `can()` stays synchronous: each process holds the table in memory, refreshes immediately on its
    own write, and picks up another process's write through a cheap digest probe
    (`backend/src/lib/permissionConfig.ts`) — never a query per call. Adding an action means adding
    it to `PERMISSION_ACTIONS`, to `DEFAULT_ROLE_PERMISSIONS`, and to `PERMISSION_GROUPS` in the
    admin; no call site changes. Every flip is audited.
23. **Selling a piece that isn't in the catalogue creates an INCOMPLETE product on purpose**
    (see "Quick sell" in `spec.md`). At the busiest hour a sale must never wait on a category, a
    cost or a photograph, so the POS takes a name and a price and completes the sale immediately —
    stock, discounts and totals behave exactly as for any other line, and nothing is held. The
    product, the order and a `(Product, completion)` change request are written in ONE transaction,
    so an abandoned checkout cannot leave a nameless half-product behind. That request is the one
    that reads backwards — the sale has already happened, so it says "this was sold, complete its
    details" and offers _complete_ / _one-off_, never _approve_ / _reject_: **rejecting must never
    look like it undoes a sale**, and it never does (an order's lines are snapshots). Empty is a
    supported state, not a broken record: `Product.categoryId` is nullable ONLY for this, `cost` is
    absent rather than zero (which is what the reports' missing-cost warning counts), and every
    screen that lists products must handle a categoryless one — which is why such a product is
    badged incomplete and has a "needs completing" queue of its own, since no category filter can
    find it. `product.quickSell` is every role's; `product.complete` is Admin/Manager and is what
    decides a completion request, so `changeRequest.approve` stays a separate action (Admin-only as
    shipped).

## Workflow

- Build **one stage at a time** (see the build order in `spec.md`). Test a stage before the next.
- Run Prisma migrations for any schema change; never edit the DB by hand.
- Keep shared types in `shared/` — don't redefine the Product/Variant shape in each project.
- Prefer small, reviewable changes over large sweeps.

## Commands (fill in real ones as they're set up)

The repo is one npm workspace: install once at the root, then drive each project with `-w`
(the flag takes the directory name). Running a script from inside a project directory works too
— it is the same install either way.

```
# once, at the repo root — installs all four projects and compiles shared/
npm install

# backend
npm run dev -w backend
cd backend && npx prisma migrate dev
cd backend && npx prisma studio

# admin / pos
npm run dev -w admin
npm run dev -w pos

# the admin's own suite (admin/tests): what a signed-in person can see and do in
# the SHELL, for every role. jsdom, no server needed — unlike backend/tests.
npm run test -w admin

# everything at once
npm run build          # shared, then backend, admin, pos
npm run typecheck
npm run lint           # eslint everywhere; every if/else/loop body is braced (curly: all)
npm run format         # prettier: double quotes, 2 spaces, width 120 (.prettierrc.json)
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

**All three images are multi-stage, and only the last stage ships.** The build stage has the full
workspace and toolchain; the runtime stage gets production dependencies and build output and
nothing else — no TypeScript, no vitest, no source tree it does not need. admin and pos use Next's
`output: "standalone"`, so their runtime is the traced server bundle plus `public/` and
`.next/static`, not `node_modules`. Every runtime stage runs as the base image's unprivileged
`node` user, which is why the uploads volume has to be owned by uid 1000 (see `ops/README.md`).
Two things are easy to break here and are worth re-checking after any Dockerfile edit: the
`NEXT_PUBLIC_*` build args must be set in the stage that runs `next build` — they are baked into
the bundle there, `NEXT_PUBLIC_APP_ENV` is what decides the environment's icons and
`NEXT_PUBLIC_APP_NAME` what the installed app is called — and the
backend's runtime needs `openssl` plus **all three** `node_modules` directories, because zod
cannot hoist (backend and shared are on zod 3, better-auth on zod 4).

**Persistent data lives on named volumes, at absolute paths the app is told explicitly.** The
database (`sandbox_db_data` → `/var/lib/postgresql/data`) and the uploaded photographs
(`sandbox_uploads` → `/app/uploads`, with `UPLOAD_DIR` set in the compose file's `environment:`,
never left to `.env`) are the only things a deploy cannot rebuild. The search index
(`sandbox_search_data` → `/meili_data`) is on a volume too, but it can be rebuilt from the
database at any time, so it is not backed up; `MEILI_MASTER_KEY` must be set in the stack's env
file, or compose refuses to start. A **relative** `UPLOAD_DIR`
resolves against the container's working directory (`/app/backend`), which is how every uploaded
image was being written into the container layer and lost on each deploy — so any new service or
compose file states its data path absolutely and mounts a volume there. Never rename a volume key
or change `STACK_NAME` in a stack's env file (the compose `name:` reads it): both feed the real
volume name, and changing either points the stack at a new empty volume. See `ops/README.md` for backups — the volumes survive redeploys, not disks.

## When unsure

Check `spec.md` first. If the answer isn't there, ask the user. Never silently guess product
behavior — guessing is what broke the previous attempt.

## Code organization (apply everywhere, backend + frontends)

- **Use path aliases, not relative paths.** Within a project, import local modules with `@/`
  (e.g. `@/lib/auth`, `@/routes/products`) — never `../../lib/auth`. Configure that alias in each
  project's `tsconfig.json` (and the bundler/runtime resolver) so it works at build and runtime.
  The cross-app shared package is **not** an alias: the repo is one npm workspace and `shared/` is
  published into it as `@store/shared`, so import it by package name
  (e.g. `@store/shared/types`, `@store/shared/constants/errors`) and let node_modules resolve
  it. Its subpaths come from the `exports` map in `shared/package.json` — add a new folder there
  (and to the matching `typesVersions` block, which is what the backend's node10 resolver reads)
  before importing it.
- **No inline/ad-hoc types scattered across files.** Centralize types in a dedicated `types/`
  directory, split into focused files by domain (e.g. `types/product.ts`, `types/user.ts`,
  `types/common.ts`) and re-export from a barrel (`types/index.ts`). Shared cross-app types live in
  the `shared/` package.
- **All constants live in one place.** No magic strings/numbers inline. Put them under a
  `constants/` directory (e.g. `constants/sku.ts`, `constants/images.ts`, `constants/errors.ts`)
  and import from there. This includes the `ORG-` prefix, image sizes, size/type limits, error
  keys, default page sizes, the +970/+972 prefixes, etc.
- **Comments: one line, or none.** Write a comment only when it says something important about
  the feature that the code cannot (a business rule, a non-obvious why) — and keep it to a single
  line. No multi-line explanation blocks, no narrating what the code does, no history.
- These are **structural rules**: when refactoring to satisfy them, move/rename only — never change
  behavior — and keep `tsc` type-check and the build passing.

## Test selectors — naming what is on the screen

Every element worth diagnosing carries **`data-test-selector`**, a stable name saying WHAT IT IS.
"The button in the corner" is not a description on a screen that mirrors itself in Arabic, and a
Tailwind class is not a name — it changes the next time the design does.

- **`data-test-selector`, never an `id` or a class.** Ids are for `htmlFor`/`aria-*` and must stay
  unique per document; classes are styling and are rewritten by every redesign.
- **Lower case, hyphenated, purpose-first:** `product-card`, `pos-cart-total`, `checkout-button`,
  `variant-picker`. Never appearance or position — no `left`, no `start-side`, no `first`: the
  layout mirrors in RTL and the name would then be wrong in Arabic.
- **Family + instance where a list repeats:** `product-card` for the family, `product-card-<id>`
  for one of them. The instance half is an **id**, never a customer's name, a phone number or a
  price — the attribute ships to production, and it identifies an element rather than describing
  its contents.
- **The POS prefixes everything with `pos-`;** the admin's names are unprefixed. Two apps, one
  vocabulary, no collisions in a report that spans both.
- **Names come from `@store/shared/lib/testSelector`** (`testSelectorFor`, `fieldTestSelector`,
  `fieldErrorTestSelector`, `toSelectorName`) rather than from hand-built strings, so both apps
  spell the same idea the same way.
- **Kept in production builds.** The deployed app is where problems appear; an attribute stripped
  from the build is no use to whoever is describing one. They weigh nothing and expose nothing.

**Naming a `@store/ui` component:** pass the name as its `data-testid` prop; the component writes it
to both `data-testid` and `data-test-selector` and names its parts `<name>-<part>` (an `Input`
named `field-<id>` puts that on its wrapper and `field-<id>-control` on the `<input>`). Plain
elements carry a literal `data-test-selector`.

**What to cover:** cards and list rows, table rows, primary action buttons, form fields and their
errors, sheets and dialogs, navigation items, empty and error states, and the numbered-shawl point
markers (`shawl-point-<number>`). **Not** every wrapper `<div>` — a name on everything is a name on
nothing.
