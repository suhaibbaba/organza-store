# CLAUDE.md — Organza Store

Rules for working in this repo. Read this before making any change.
Full product logic lives in `spec.md` — this file is the operating manual.

## What this project is
Custom e-commerce + POS system for a clothing shop. **Not** Medusa or any e-commerce framework.
Build it from scratch with the stack below. If something is ambiguous, check `spec.md`;
if it's still unclear, **ask before assuming** — do not invent product behavior.

## Repo structure (4 separate projects + shared, one npm workspace)
```
organza-store/
├── package.json      workspace root — declares the workspaces, holds the only lockfile
├── backend/     API — Node + Express + TypeScript + Prisma + PostgreSQL
├── admin/       Admin dashboard — Next.js
├── pos/         Point-of-sale — Next.js
├── frontend/    Customer storefront — Next.js (LATER, not this phase)
└── shared/      Shared TypeScript types + Zod schemas — published as @organza/shared
```
Each project has its own `package.json`, and the root one ties them together as **npm
workspaces**. There is exactly one `package-lock.json`, at the root; per-project lockfiles must
never come back. `shared/` is a real dependency of the others (`@organza/shared`), resolved
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
   That table is the shop's **starting point**: most of it is editable per shop from the admin's
   Permissions screen, and a specific part of it can never be — see rule 22.
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
22. **Every permission action is PROTECTED or CONFIGURABLE** — declared beside the action itself in
    `shared/src/constants/permissions.ts`, exhaustive and disjoint, checked at module load (see
    "Editable role permissions" in `spec.md`). **PROTECTED** is answered by `can()` from the shipped
    table and nothing else: cost/profit and the reports, re-pricing, editing/cancelling/deleting/
    returning an order, gifts, marking money collected, approving a change or an expense, managing
    staff, reading an ID number, and managing permissions itself. Those are the anti-theft
    guarantees the whole design rests on, plus the ones a locked-out Admin could never undo — so
    there is deliberately no row, no endpoint and no screen that can move them, and the API refuses
    a protected action **server-side**, not merely hides it. **CONFIGURABLE** grants live one row
    per (role, action) in `RolePermission`, seeded from today's exact defaults by
    `npm run bootstrap` (rule 11), with a MISSING row meaning "as shipped" rather than "no".
    `can()` stays synchronous: each process holds the table in memory, refreshes immediately on its
    own write, and picks up another process's write through a cheap digest probe
    (`backend/src/lib/permissionConfig.ts`) — never a query per call. Adding an action means adding
    it to one of the two lists, to `DEFAULT_ROLE_PERMISSIONS`, and to `PERMISSION_GROUPS` in the
    admin; no call site changes. Editing is Admin-only, never your own role, and every flip is
    audited.
23. **Selling a piece that isn't in the catalogue creates an INCOMPLETE product on purpose**
    (see "Quick sell" in `spec.md`). At the busiest hour a sale must never wait on a category, a
    cost or a photograph, so the POS takes a name and a price and completes the sale immediately —
    stock, discounts and totals behave exactly as for any other line, and nothing is held. The
    product, the order and a `(Product, completion)` change request are written in ONE transaction,
    so an abandoned checkout cannot leave a nameless half-product behind. That request is the one
    that reads backwards — the sale has already happened, so it says "this was sold, complete its
    details" and offers *complete* / *one-off*, never *approve* / *reject*: **rejecting must never
    look like it undoes a sale**, and it never does (an order's lines are snapshots). Empty is a
    supported state, not a broken record: `Product.categoryId` is nullable ONLY for this, `cost` is
    absent rather than zero (which is what the reports' missing-cost warning counts), and every
    screen that lists products must handle a categoryless one — which is why such a product is
    badged incomplete and has a "needs completing" queue of its own, since no category filter can
    find it. `product.quickSell` is every role's; `product.complete` is Admin/Manager and is what
    decides a completion request, so `changeRequest.approve` stays Admin-only and PROTECTED.

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
the bundle there, and `NEXT_PUBLIC_APP_ENV` is what decides the environment's icons — and the
backend's runtime needs `openssl` plus **all three** `node_modules` directories, because zod
cannot hoist (backend and shared are on zod 3, better-auth on zod 4).

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
  (e.g. `@/lib/auth`, `@/routes/products`) — never `../../lib/auth`. Configure that alias in each
  project's `tsconfig.json` (and the bundler/runtime resolver) so it works at build and runtime.
  The cross-app shared package is **not** an alias: the repo is one npm workspace and `shared/` is
  published into it as `@organza/shared`, so import it by package name
  (e.g. `@organza/shared/types`, `@organza/shared/constants/errors`) and let node_modules resolve
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
- These are **structural rules**: when refactoring to satisfy them, move/rename only — never change
  behavior — and keep `tsc` type-check and the build passing.

## The oldest phone on the floor decides (admin + pos)
The shop's main device runs **iOS 15**, and both apps declare it in their browserslist
(`ios_saf >= 15`). CSS fails silently there — no build error, no console message, every desktop
browser perfect — so this is enforced by the build rather than by review.

- **Every colour and every length ships a value iOS 15 can read.** The palette is written in
  `oklch()` and stays that way; the build emits a plain sRGB fallback in front of each one. That
  only works for a colour the compiler can EVALUATE, so **never put a `var()` inside a colour
  function** — `oklch(0.44 0.06 var(--brand-hue))` is emitted raw, with nothing behind it, and
  that is exactly what left every button in both apps with no background and every badge a blank
  coloured pill. The brand hues are literals in `globals.css`; the note at the top of the palette
  says why.
- **Three build guards, one per failure mode**, wired into `npm run build` in both apps:
  `shared/scripts/check-messages.js` (source messages), then `next build`, then
  `check-browser-target.js` (JS parses) and `check-css-target.js` (CSS is usable). The CSS one
  separates FATAL — a colour or length with nothing behind it, or an at-rule that takes its whole
  block with it — from DEGRADED, which it names and allows: `:has()`, `:focus-visible`,
  `::backdrop`, `accent-color`, `backdrop-filter`, `@property`. Losing an effect is fine; losing a
  stylesheet is not.
- **`shared/scripts/postcss-ios15.cjs` runs after Tailwind and repairs what the framework cannot.**
  It flattens `@layer` (an unknown at-rule is dropped WITH its block, so one `@layer` discards the
  whole sheet on 15.0–15.3), rewrites Tailwind's `color-mix()` opacity modifiers to
  `rgb(var(--token-rgb) / N%)` so `bg-primary/10` is a tint rather than the solid colour, and puts
  a `vh` fallback before every `dvh`. Its own header explains each pass.
- **Numbers and dates are stated, never inherited.** `Intl` takes its numbering system from the
  device: recent ICU writes `ar` in western digits, iOS 15's writes it in Arabic-Indic ones, so
  the same price reads two ways on two devices in one shop. Every `Intl` call in both apps spreads
  `NUMBER_FORMAT_BASE` / `DATE_FORMAT_BASE` from `@organza/shared/constants/formatting` (western
  digits, Gregorian calendar), and a figure inside a sentence is written `{count, number, plain}` —
  never ICU's `#`, which is formatted with the bare locale. `check-messages.js` refuses `#`, a
  bare `{arg, number}`, and Arabic-Indic digits typed into the copy.

## Frontend UX — mobile-first, simple, RTL (admin + pos)
The people using the admin and POS are **not tech-savvy**, and ~**95% of use is on mobile phones**.
Design for that reality:

- **Mobile-first, not merely responsive.** Design and build for a phone screen FIRST, then scale
  up to desktop. Single-column layouts by default; never a desktop layout crammed onto a phone.
- **Nothing zooms, so nothing may depend on zooming.** Page zoom is off in both apps — viewport
  (`maximumScale: 1`, `userScalable: false`), `touch-action: manipulation`, and the gesture guards
  in `components/pwa/native-gesture-guard.tsx` for iOS, which ignores the viewport. So: **every
  form field is at least 16px** (Safari zooms the page in on focus below that, and there is now no
  way back out), 44px stays the floor for anything a thumb hits, and **no interface text goes below
  12px**. Anything that genuinely wants two fingers marks itself `data-allow-zoom="true"`.
- **A long press must not raise the system sheet.** Text selection and the iOS callout are off
  app-wide and opted back in with `data-selectable="true"` — for a barcode, a SKU, an order number,
  a phone number, an address: things somebody copies. Not for cards, rows or buttons.
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
- **Arabic needs more vertical room than Latin at the same size — the type scale already gives it.**
  Cairo's ink runs from ~0.7em above the baseline to ~0.45em below it, so Tailwind's Latin line
  heights (text-sm at 1.43, text-2xl at 1.33) leave the tails of ج ح خ ي outside the line box, where
  the first `truncate` or `line-clamp` slices them off. Both apps therefore override every
  `--text-*--line-height` (and the inherited `html` line height) in `globals.css` — around 1.8 at
  interface sizes. **Do not put `leading-tight`, `leading-snug` or `leading-none` back on Arabic
  text**: they undo it, and the damage only shows where something clips. `leading-none` is for
  content that is digits or a single glyph by construction (a count badge, a numbered-shawl
  marker) and nothing else. Any new fixed-height text box has to fit the line box the scale gives
  it — prefer `min-h-*` with padding over `h-*`, and check with `ملاحظات على الخيارات جحخي`.
- **Accessibility basics:** readable font sizes on mobile, sufficient contrast, labels on inputs.
- **Whoever is signed in is named IN THE SHELL, never on a page.** The header carries the
  account — name, role, sign-out, the app version — at every width and for every role, sourced
  from the session (`components/layout/account-menu.tsx`, mirroring the POS's). It may never be
  hidden below a breakpoint, and it may never be the dashboard's job: the dashboard is
  Admin/Manager only, so tying identity to it takes their own name away from the one role that
  spends all day filing orders under it. The same holds for anything a person always needs — the
  language switcher, the sandbox badge, the way out. Nothing that must always be reachable may
  live behind a permission-gated page, and nothing may live *only* in the bottom nav's "More"
  sheet either: that sheet exists only when a role has more nav entries than the four tabs hold.
- **A person is named through `lib/user-display.ts`, never by rendering `user.name` raw.**
  One rule for both apps (`shared/src/lib/userDisplay.ts`): their name, then the local part of
  their email, then their translated role — and **never an internal id**. An id is meaningless to
  staff, unbounded in length so it stretches whatever is drawn around it, and a top bar reading
  "Admin mt0grbxoqx7nbf" looks broken rather than informative. Id-shaped words are stripped from a
  stored name (the test suite once renamed the sandbox's Admin and never put it back), and the
  avatar's letter comes from the same source as the name so the two can never disagree. Long names
  truncate with an ellipsis; they never widen the header.
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
- **Names come from `@organza/shared/lib/testSelector`** (`testSelectorFor`, `fieldTestSelector`,
  `fieldErrorTestSelector`, `toSelectorName`) rather than from hand-built strings, so both apps
  spell the same idea the same way.
- **Kept in production builds.** The deployed app is where problems appear; an attribute stripped
  from the build is no use to whoever is describing one. They weigh nothing and expose nothing.

**Applied at the shared-component level wherever possible, so new screens inherit it:**
`Input`/`Textarea`/`Select`/`Checkbox`/`Switch` name themselves `field-<id>` from their own id;
`FieldError` names the message under a field `field-<id>-error`; `Alert` names itself by kind;
`SheetContent`, `StatCard`, `FigureCard`, `PageHeader`, `SegmentedControl` and `QuantityStepper`
take a `name` prop and render `sheet-<name>`, `stat-card-<name>` and so on. Add the name to the
shared component once; only reach for a literal attribute where the element is one of a kind.

**What to cover:** cards and list rows, table rows, primary action buttons, form fields and their
errors, sheets and dialogs, navigation items, empty and error states, and the numbered-shawl point
markers (`shawl-point-<number>`). **Not** every wrapper `<div>` — a name on everything is a name on
nothing.

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
