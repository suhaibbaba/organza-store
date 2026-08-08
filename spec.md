# Organza Store — Specification (Phase 1)

## Overview
E-commerce system for a clothing shop (Organza, Tulkarm branch).
Custom build — **not** Medusa or any e-commerce framework.

**Phase 1 (DONE):** Products, Variants, Categories, Inventory, Users/Roles, Settings, Images,
Audit Log + the full admin UI.
**Phase 2 (CURRENT):** Orders — see the "Phase 2: Orders" section, then POS, admin orders page,
and sales/profit reporting.
**Phase 3 (later):** Customer storefront + real Customer accounts.

## Architecture — 4 separate projects
```
organza-store/
├── backend/     API (Node + Express + TypeScript + Prisma + PostgreSQL)
├── admin/       Admin dashboard (Next.js)
├── pos/         Point-of-sale screen (Next.js)
├── frontend/    Customer storefront (Next.js — later)
└── shared/      Shared TypeScript types + Zod schemas (imported by all)
```
- **API style:** REST.
- **All frontends are Next.js** (not plain React, not any other framework).
- **Auth:** JWT.
- **Hosting:** the user's own VPS + GitHub Actions (existing setup).

---

## Products & Variants

### Product (parent)
Holds the shared/general info:
- `name`, auto-generated `slug`, `description`
- `category` (nested categories supported: e.g. Women > Dresses > Evening; a category may be
  flagged `isFavorite` to pin it at the top of the POS product browser — see "POS product browser")
- `primaryImage` + `gallery` (ordered images, drag-to-reorder, lowest sortOrder = primary)
- `barcode`
- `basePrice` — the product's base price
- `compareAtPrice` — optional "was" price for showing discounts
- `cost` — optional purchase cost (for profit calculation)

**Simple product (no variants):** `sku`, `stock`, `barcode` live directly on the product.
When a product HAS variants, the parent's `sku`/`stock` are disabled in the UI (variants own them).

### Variant (child)
The actual purchasable item:
- `name` — auto-suggested from its option combination (e.g. "أحمر / M"), editable
- `sku` — auto-generated, editable
- `barcode` — per variant (needed for POS scanning)
- `priceOverride` — optional; **if empty, falls back to the parent's `basePrice`**
- `cost` — optional; **if empty, falls back to the parent's `cost`**
- `stock` — default **1**, editable
- optional `primaryImage` / `gallery` — if empty, falls back to the parent's images
- `values` — references to the global option values that define it

**Fallback rule (both price and cost):** any value left empty on a variant is inherited
from the parent. The variant only overrides when a value is explicitly set.

### Variant Types & Values (GLOBAL, shared)
A central pool of option types and their values, shared across all products:
- `Color` → [أحمر, أزرق, أصفر, ...]
- `Size`  → [S, M, L, XL]
- `Number`→ [38, 40, 42, ...]   ← just another option type, same logic

**"Number/الأرقام" is not special — it's a normal variant type.**

When creating a product you pick one OR more types (Color only / Size only / Color+Size / …).
The system generates variants from the **cartesian product** of the chosen values.
Example: Color[أحمر, أزرق] × Size[M, L] → 4 variants. You can delete combinations you don't stock.

### The reference relationship (important)
A variant does **not** store the text "أحمر" inside itself. It stores a **reference (ID)** to the
"أحمر" row in the global values table. So renaming "أحمر" → "أحمر خمري" in one place updates it
everywhere automatically. (Same approach as Shopify / WooCommerce / Medusa.)

### Inline add (to make data entry fast)
From inside the product screen the user can:
1. **Add a new value to an existing type** — type "أصفر" under Color; on save it's added to the
   global Color values and becomes available to all products.
2. **Add a whole new variant type** — e.g. "Material"; created as a new global type.
Both auto-save to the global tables the moment the product is saved. A dedicated
management screen for variant types still exists (for cleanup/edit/delete) but is optional to use.

Adding this way is open to every role that can add a product, Employees included — it only ever
appends, so nothing already on the shelf changes. Renaming or deleting an existing type/value is
Admin/Manager only: it reaches every product using that value at once (see the reference rule
above), which is exactly what makes it dangerous in the wrong hands.

---

## SKU (auto-generated)
- Fixed store prefix: **`ORG-`**
- Pattern:
  - Simple product: `ORG-00042` (`00042` = zero-padded `productNumber`)
  - Variant: `ORG-00042-1`, `ORG-00042-2`, … (`-N` = sequential `variantNumber` within the product)
- **Frozen at creation** — does NOT change if category/options are edited later (so printed
  barcodes never break).
- Editable manually, but must stay **unique**.

---

## Settings (store-wide config)
A singleton `Setting` row holds: `storeName` (translatable), `defaultLanguage` (ar, configurable),
`supportedLanguages`, `currency`, `lowStockThreshold`. Managed from the admin Settings screen (Admin only).

## Currency
- Default: **ILS (شيكل)**. Not changeable right now, but stored as a field so **multi-currency can be
  added later** without restructuring. Prices are stored as `Decimal` in the store currency.
- The currency symbol/format shown in the UI comes from settings, never hard-coded.

## Barcode (auto-generated, or the supplier's own)
- **Every product and variant gets a system-generated, unique barcode** (not the SKU). Use a
  standard format (**EAN-13**) so any scanner/label printer works.
- Generated once at creation and unique across the store. This is the default and covers every
  piece that arrives with nothing printed on it.

### Supplier barcodes
Many garments arrive **already barcoded**. Printing our own label over a perfectly good one wastes
a label and a minute per piece, so the shop can scan the supplier's code and keep it instead.

- **The barcode field is editable** — typed or scanned — on create and on edit, for the parent
  product and for each variant individually. On a phone it is filled with the camera; on the
  counter's laptop with the wedge scanner, whose characters are read off the key's physical
  position so an Arabic keyboard layout doesn't turn `5` into `٥`, and whose terminating Enter must
  not submit the form.
- **The source is stored, not guessed:** `Product.barcodeSource` / `Variant.barcodeSource`
  (`GENERATED` | `SUPPLIER`). A supplier's EAN-13 is indistinguishable from one of ours, and the
  source is what decides whether a label is owed.
- **Reversible at any time.** Switching to the supplier's code parks ours; switching back
  **restores** it, so a label already printed and stuck on the piece still scans. Only if that code
  has since been taken is a fresh one minted.
- **Accepted formats:** EAN-13, EAN-8, UPC-A and the free-form Code 128 / Code 39 strings small
  suppliers print. Whitespace is stripped and Arabic-Indic digits folded to ASCII before storing.
  No check digit is required — a code a scanner reads and a supplier printed is a valid code.
- **Unique across the whole store**, products and variants sharing one namespace: a duplicate would
  silently sell the wrong piece. A clash is refused with `error.barcode.duplicate`, naming what it
  clashed with, and the two ways out (put one shared code on the parent, or keep the generated
  barcode and print a label).
- **A shared parent code.** Some suppliers print ONE code for all sizes; the shop then puts it on
  the parent rather than printing a label per variant. Scanning it must not resolve to a single
  item — it opens the **variant picker**, listing each variant with its stock (zero-stock ones
  disabled but visible, multi-select kept) so the cashier picks what actually sold. This is the
  numbered-shawl parent scan generalised, not a second mechanism: any parent with variants answers
  a scan with `PRODUCT_LOOKUP_KIND.VARIANT_SELECTION`, and the orders API refuses a sale that names
  no variant (`error.order.variant_required`). Both levels coexist — a variant's own code adds it
  to the cart directly.
- **Labels:** a supplier-coded piece is excluded from the "not printed yet" queue **by source**,
  and the screen says so ("supplier barcode — no label needed") rather than faking a print date.
  Printing one anyway is always allowed — the count simply starts at zero.
- Barcode and source changes are audited old → new like any other field, and follow the same
  permissions as the SKU beside them (`product.edit`); they are not one of the gated Employee
  actions.

## Slug conflicts
Slugs are generated from the default-language name. On collision, append an incrementing numeric
suffix: `evening-dress`, `evening-dress-2`, `evening-dress-3`, …

## Lists: filtering, pagination, sorting
All list endpoints (products, inventory, search, later orders) support **pagination + filtering +
sorting**. Products filter by: category, active/hidden, in/out of stock, price range, and search
query. Default page size sensible (e.g. 20). Never return unbounded lists.

## Unified API response shape
Every endpoint returns a consistent envelope so admin + pos handle them identically:
```
// success
{ "success": true, "data": ..., "meta": { pagination... } }
// error
{ "success": false, "error": { "code": "error.sku.duplicate", "details": ... } }
```
**Errors return a translation KEY (`error.*`), not a human sentence.** The frontend translates the
key into the user's language.

## Auth (details)
- **Library: Better Auth** — central auth in the separate backend, serving admin + pos (and later
  the storefront). Free, self-hosted on the VPS. Chosen over NextAuth (which suits a fullstack
  Next.js app, not a separate API) and Lucia (discontinued). OTP/passkey can be added later as
  plugins for customers without a rewrite.
- Login is by **email + password only.** (Phone is kept as a contact field but is NOT a login
  method.) Sessions/tokens handled by Better Auth.
- Auth tables (User/Session/Account/Verification) come from Better Auth's schema — generate/verify
  with its CLI (`npx @better-auth/cli generate`). Password is stored (hashed) by Better Auth in
  `Account`, **not** on `User`.
- **Password reset is admin-driven** (Admin sets/resets staff passwords; no email self-reset).
- Role checks enforced on the **backend** for every protected route.
- Keep auth behind a thin wrapper so plugins (OTP/passkey for customers) slot in later.

## Phone numbers
- **`phone` and `whatsapp` are both required-unique / optional-unique respectively**, and both are
  **stored exactly as entered** in E.164 (e.g. `+970599123456` or `+972599123456`) — we do NOT
  rewrite the prefix, so WhatsApp messages reach the number on its real prefix.
- **Phone is a contact field only — not a login method.**
- Validate format with **`libphonenumber-js`** before saving.
- **Palestine dual-prefix uniqueness (+970 / +972):** since the same line can be written with either
  prefix, uniqueness is enforced by **checking both prefixes**, not by rewriting the number. Before
  saving a number, look it up under both `+970<national>` and `+972<national>`; if either exists,
  it's a duplicate. This applies to **both `phone` and `whatsapp`** (both unique).
- **Verification:** only **format validation** (free, local). Ownership OTP is not free and is not
  needed for staff (Admin creates their accounts).

## Sensitive fields (never exposed broadly)
- **`cost`** (purchase cost) **and everything derived from it** — COGS, gross profit, net profit,
  margin, the inventory valuation at cost: **Admin only**. Never returned by the API to a Manager
  or an Employee — enforced on the backend, not just hidden in the UI. A Manager runs the shop
  floor; the owner's margin is not theirs to read.
- **`idNumber`** (staff ID): **Admin only**. Optional field. Never returned by the API to others.

## No static text — everything is translated
**No user-facing string may be hard-coded, anywhere.** Every label, button, title, placeholder,
confirmation, validation message, and toast goes through the translation function `t()`.
- Frontend (admin + pos): all UI strings via `next-intl` keys.
- Backend: returns **translation keys** (e.g. `error.product.not_found`), never literal sentences;
  the frontend renders them in the user's language.
This is a hard rule — a single hard-coded string is a bug.

## Error tracking
- **Sentry** (free tier) captures technical errors/exceptions across backend + admin + pos, with
  stack traces, grouping, and email alerts. This is separate from the Audit Log (which is a
  business record shown in the admin).
- Written behind an **isolated logging layer** so it can be swapped for **GlitchTip**
  (self-hosted, open-source, Sentry-compatible) later with no code changes.

---

## Languages & translation (i18n)
Two separate layers:

### 1. UI language (interface text)
Buttons, menus, labels ("Add product", "Inventory"...). Handled with **`next-intl`**
translation files. Does not touch the database.

### 2. Product content (data) — affects the schema
Translatable fields: product `name` + `description`, category `name`,
variant type `name`, and option `value`.

- Stored as **JSON** per field: `{ "ar": "فستان", "en": "Dress", "he": "שמלה" }`.
- **Arabic (`ar`) is the default language**, configurable in settings.
- A missing translation **falls back to the default language**.
- Identity/uniqueness never depends on translated text:
  - `slug` (products, categories) generated from the default-language value.
  - `VariantType.slug` and `VariantOptionValue.key` are stable identifiers used for uniqueness.

Supported languages at launch: **Arabic (default), English, Hebrew.** Adding a language later is
just another key in the JSON — no schema change.

## Search (smart, cross-language, typo-tolerant)
The search must be **cross-language**: typing "فستان" while on the English UI still finds the
product, because all translations live in the same record. Rules:

- **Searches across ALL stored languages**, not just the current UI language.
- **Normalization** (applied to both query and content before matching):
  - strip Arabic diacritics/tashkeel (فَستان = فستان)
  - unify similar Arabic letters (أ/إ/آ/ا, ة/ه, ى/ي, ؤ/و ...)
- **Typo tolerance (fuzzy):** via Postgres **`pg_trgm`** (free, built-in extension) — finds words
  with a missing/extra/wrong letter.
- Implemented as an **isolated search layer** so it can be upgraded later (e.g. self-hosted
  Meilisearch) without touching callers.

**Performance note:** each Product stores a `searchText` field = normalized concatenation of all
language names+descriptions, with a GIN trigram index. Rebuilt whenever name/description change.
This keeps fuzzy cross-language search fast even with thousands of products.

**Everything here is free/open-source** — pg_trgm is part of Postgres, next-intl is open-source,
translations live in the DB. No paid search or translation services.

---

## Images — storage & optimization
- **Stored locally on the VPS** (no external service like Cloudinary).
- **On upload (backend):** process with **`sharp`** before saving:
  - compress + resize
  - convert to **WebP**
  - generate multiple sizes (thumbnail for lists, medium for POS, full for product page)
- **On display (frontend):** use Next.js **`next/image`** (lazy load, right size per screen, caching).

---

## Barcode / QR scanning (POS)
- Library: **`html5-qrcode`** — broad browser support incl. **mobile** (iOS Safari + Android Chrome),
  rear-camera support, reads both 1D barcodes and QR.
- Fallback if 1D accuracy is poor: **`@zxing/library`**.
- Written as an **isolated scanner component** so the engine can be swapped in one place.
- **Requires HTTPS** on the POS (mandatory for camera access on iOS).

---

## POS product browser (picking by eye)
Not every piece can carry a label. A silk scarf has nothing to stick one to, and some cashiers are
simply faster finding a garment by its photo than by typing its name. So the selling screen has a
fourth way in, beside the camera, the counter's hand scanner and the search box — and it ends in
the same cart, through the same lookup.

- **A drawer, not a screen.** A clear labelled button under the search box opens it; it slides in
  from the **start edge** (right in Arabic, left in English) over the sale, with the backdrop
  fading in. It closes on the ✕, on the backdrop, on Escape, and by itself the moment something is
  picked — the cart it was covering is exactly as it was, with one more line on it. It never
  permanently occupies the screen.
- **Two columns.** Categories down the start side, product grid on the other. Both scroll
  independently.
- **Sidebar = categories, never products.** "All" first, then the shop's **favourites**, then the
  whole tree indented under its parents. Selecting one filters the grid; selecting a parent shows
  everything filed under it, not just what hangs off the parent itself.
- **Favourite categories** are flagged by hand in the admin (a star on each row of the category
  screen, `category.manage`) and stored on the category (`Category.isFavorite`) — **server-side, so
  every till and every phone agrees**, not a per-device preference. A pinned category still appears
  in the tree below as well.
- **Cards** show the photo (the shared placeholder when there is none), the name, the price, and a
  red/amber/green stock badge **that always spells its state out in words**. Out of stock stays
  visible but cannot be tapped. A product with variants is marked exactly as it is in the search
  results — accent bar, tinted card, chevron instead of "+" — and a numbered collection shows its
  number count.
- **Search inside the drawer** is the same cross-language, typo-tolerant search the selling screen
  runs, narrowed to the selected category. A search that finds nothing inside a category offers a
  way back out to all of them.
- **Tapping a product does exactly what tapping a search result does:** a simple product goes
  straight into the cart with the usual toast; one with variants opens the variant picker.
- **The grid is paged** ("Show more"), never an unbounded list.
- **Motion** is transforms and opacity only — the panel slide, the backdrop fade, a short staggered
  entrance for the cards, a small dip on press — and all of it is dropped under
  `prefers-reduced-motion: reduce`.

Nothing about the existing phone flow changes: the camera, the hardware scanner, the toasts, the
beep, de-duplication, quantity increment, the variant picker and the safe areas are the same code
they were, and the browser is an addition layered on top of them.

---

## Roles & Permissions
Three fixed roles.

| Capability                        | Admin | Manager | Employee |
|-----------------------------------|:-----:|:-------:|:--------:|
| POS — make sales                  |  ✅   |   ✅    |    ✅    |
| Add products                      |  ✅   |   ✅    |    ✅    |
| Edit product images               |  ✅   |   ✅    |    ✅    |
| Edit product details (name, etc.) |  ✅   |   ✅    |    ✅    |
| Edit product **price**            |  ✅   |   ✅    | ✅ (needs approval) |
| Add option type/value (inline)    |  ✅   |   ✅    |    ✅    |
| **Rename / delete** option value  |  ✅   |   ✅    |    ❌    |
| **Delete** product                |  ✅   |   ✅    |    ❌    |
| **Hide / publish** product        |  ✅   |   ✅    | ✅ (needs approval) |
| Create order + hand to courier    |  ✅   |   ✅    |    ✅    |
| **Delete / edit / cancel** order  |  ✅   |   ✅    |    ❌    |
| **Mark money collected**          |  ✅   |   ✅    |    ❌    |
| **Give stock away** (GIFT order)  |  ✅   |   ✅    |    ❌    |
| Manage stock (full)               |  ✅   |   ✅    | ✅ (needs approval) |
| **Delete** a product photo        |  ✅   |   ✅    | ✅ (needs approval) |
| Change a product's **variant set**|  ✅   |   ✅    | ✅ (needs approval) |
| Record an expense                 |  ✅   |   ✅    | ✅ (needs approval) |
| Read / edit expenses              |  ✅   |   ✅    |    ❌    |
| **Approve** a pending change      |  ✅   |   ❌    |    ❌    |
| Open + close the cash drawer      |  ✅   |   ✅    |    ❌    |
| **See cost, COGS, profit, margin**|  ✅   |   ❌    |    ❌    |
| **Open the Reports screen**       |  ✅   |   ❌    |    ❌    |
| Dashboard (sold / received / owed)|  ✅   |   ✅    |    ❌    |
| Manage users                      |  ✅   |   ❌    |    ❌    |
| Settings                          |  ✅   |   ❌    |    ❌    |

**Security rationale:** Employee can create orders and hand them to the courier but **cannot
delete or edit them**, so a sale can't be erased to cover theft — and **cannot mark its money
collected**, so the person who took a sale can't also declare its cash received. For the same
reason an Employee may fix a product's details but never **re-price** it, so nothing can be sold
cheap and pocketed, and never file an order as a **gift**, which would be the same thing with a
nicer name. Every action is tied to its author via the Audit Log.

**Reports are Admin only** (`report.view`). The Reports screen is the owner's read of the
business — what the shop sold, through which channel, what it cost and what it earned — and it is
gated on its own permission rather than on `order.view`, which every role holds so that whoever
takes an order can follow it. Reading *one* order is not reading *every* order added up. A Manager
still gets what running the floor needs from the **dashboard** (sold / received / still owed, with
every cost-derived figure absent from their payload); an **Employee** reaches neither screen, so no
shop-wide sales figure of any kind is computed for them — a 403, never a partial or zeroed one.
The same reasoning gates the outstanding-money total (`GET /api/orders/collection-summary`) on
`order.markCollected` rather than on `order.view`.

**Cost and profit are Admin only.** A Manager runs the shop floor — stock, orders, the drawer,
what was spent — but what each piece cost the owner, and therefore what the shop earns on it, is
the owner's alone. One permission (`product.viewCost`) gates the lot: the `cost` field on products
and variants, `unitCost` on order lines, the inventory valuation's cost basis, and COGS / gross
profit / net profit / margin in every report. Below it those figures are never computed into the
response at all, so there is nothing to un-hide client-side.

---

## Employee change approvals

Some changes are too consequential to hand to whoever happens to be at the counter, but refusing
them outright leaves an Employee stuck: they can see the piece in front of them, they know the
price on the tag is wrong, and there is nobody to tell. So the answer is neither "yes" nor "no" —
it is **ask**.

**What is gated.** Five things an Employee may ask for but not do:

| Change | Requested via | Applied by |
|---|---|---|
| A product's **price** (`basePrice`, `compareAtPrice`, a variant's `priceOverride`) | the product form | `product.editPrice` |
| A **manual stock** figure | the product form / the stock screen | `inventory.adjust` |
| **Deleting a photo** | the gallery | `images.delete` |
| **Hiding or unhiding** a product | the product form | `product.hide` |
| A product's **variant set** (adding combinations, removing one) | the options section | `product.editVariantSet` |

Admin and Manager hold every one of those permissions, so their edits apply immediately and no
request is ever filed. An Employee's edit is neither applied nor discarded: it is **held**, and
the screen says so against the value still in force ("waiting for approval — 39.00"), because an
edit that silently disappears is an edit somebody types again.

**Automatic stock deduction is never gated.** Stock leaving the shelf because something was
*sold* — or coming back on a return — happens on the spot, whoever rang it up. There is a customer
standing there. Only *manual* stock edits go through approval.

**One mechanism, not several.** A request is `(entity type, entity id, field, old value,
requested value)` plus who asked and who decided. Nothing about it is product-shaped, which is why
the **expense approval** is one of these too: an Employee's expense still opens `PENDING` and still
counts for nothing until it is signed off, but the thing an Admin acts on is an ordinary change
request rather than a second approval flow bolted onto the expense table. Gating a new field later
is an entry in the field table plus an applier on the backend — never another `approvalStatus`
column somewhere else.

**Superseding.** A newer request for the same field on the same entity **replaces** the older
pending one. There is never a queue of stale requests to wade through: the database holds at most
one pending request per (entity, field), and the value an Admin sees is always the latest one
asked for. What was displaced stays in the audit log.

**Deciding.** Approving **applies the change atomically** — the change and its record are one
transaction, so a half-applied approval is impossible. Rejecting **discards** it and touches
nothing (an expense is the one exception: a refused expense is marked `REJECTED` on its own row,
with who refused it, rather than sitting pending forever). Nobody decides their own request.
Approval is **Admin only** for now, modelled as a permission (`changeRequest.approve`) so it can
be widened later without touching the flow. **A Manager cannot decide a request** — deliberately,
and it is the whole reason the gate exists. Note that a Manager *does* hold `expense.approve`,
which is a different thing entirely: it means "the spending I record myself counts immediately",
never "I may sign off somebody else's". If a request ever shows a Manager as its decider it is
historical data, not a decision this API would accept today — the migration that lifted expense
approvals into this table carried each expense's existing `approvedById` across, and under the old
per-expense endpoints that could legitimately be a Manager.

**One decision per request.** A request carries exactly one `(decidedById, decidedAt)`, written
once: deciding an already-decided request is a `409`, never a silent overwrite of who agreed to
what. There is likewise never a second row describing the same decision — a decided request is
history and nothing re-files it, and the dev seed clears any earlier row for the same
(entity type, entity id, field) before writing its own, so a database that went through the
expense-approval backfill does not end up listing one refusal twice under two different deciders.

**Withdrawing.** The person who asked may take a pending request back (`changeRequest.cancel`,
held by every role) — somebody who typed the wrong price should not have to occupy an Admin's
attention to undo it. Two conditions, both enforced on the backend: it must be **your own**
request, and it must still be **pending**. There is deliberately no Admin override — an Admin who
disagrees *rejects*, which stays on the record with their name on it — and a decided request can
never be withdrawn, because that would erase somebody else's answer. Withdrawing removes the row
(freeing the pending slot, so the same field can be asked about again immediately) and writes a
`CANCEL` audit entry carrying what was asked for, exactly the way a superseded request survives.
The UI asks for a confirmation first.

**Who sees what.** An Admin sees everything waiting and can act on it. Everyone else sees only
what they themselves asked for, enforced on the backend — an Employee has to be able to follow
their own request, and nothing more. Both get a count on the navigation.

**What a card says.** The **product's name** heads every request that has one, because that is the
question an approver actually asks — *which piece is this about?* The entity's own label sits
underneath as secondary detail, which matters on a variant: the entity there is the combination
(`أحمر / M`), and on its own it named nothing. Both are snapshots taken when the request is filed
(`productLabel` / `entityLabel`), so a card still reads correctly after the product is renamed or
soft-deleted, and the screen needs no second query per row. An expense has no product behind it,
so its category heads the card instead. The cards are **informational only** — nothing on one
navigates; the decisions are the only things you can touch.

**The trail.** Every request, every superseding, every approval and every rejection writes an
audit entry — who asked, and who decided. Approving also writes the entity's own entry
(`PRICE_CHANGE`, `STOCK_CHANGE`, `HIDE`, ...) attributed to whoever approved it: they are the one
who made it happen.

**Notification.** Creating a request notifies the Admins over Web Push, reusing the sale
notification transport (translation keys and data, never a sentence). With no VAPID keys
configured it is silently off, exactly like sale notifications.

---

## Soft delete
Products are never hard-deleted (they may be linked to past orders). Deleting sets `deletedAt`
and hides the product from all normal views. Role-gated (Manager/Admin only).

---

## Audit Log
Every meaningful action is recorded: who (`userId`), what (`action`), on which entity
(`entityType` + `entityId`), and the `oldValue` / `newValue`. Covers create/update/delete,
publish/hide, stock changes, price changes, and — for gated changes — who **requested** one, whose
request **superseded** an earlier one, and who **approved** or **rejected** it.

---

## Admin dashboard — what's available
- **Dashboard:** today/month sales summary, top products, low-stock alerts
- **Orders:** list/filter/search, order detail, status flow, returns
- **Collection:** money still with the delivery company — the outstanding total and the orders it
  is spread over, ticked off one or several at a time (Admin/Manager)
- **Products:** add/edit/delete, manage variants & options, upload/reorder images, categories
- **Inventory:** per-variant quantities, manual adjust, low-stock threshold alerts
- **Categories:** nested category management
- **Reports:** sales by period / by product / best sellers, sold vs. collected (**Admin only**).
  Figures only — **no chart**, for the same reason the dashboard has none: the reader is on a
  phone and needs a number they can act on, not a trend to interpret. Every figure carries the
  same tap-to-expand **(?)** explanation the dashboard uses.
- **Users:** manage Admin/Manager/Employee (Admin only)
- **Variant Types:** manage the global option types/values (cleanup)
- **Settings:** store info, currency, stock thresholds (Admin only)

---

## Libraries per project

### backend/
- `express` — server
- `prisma` + `@prisma/client` — DB & ORM
- `zod` — input validation
- `better-auth` — authentication (email/phone + password; OTP/passkey later)
- `libphonenumber-js` — phone validation/normalization (E.164)
- `slugify` — slug generation from name
- `multer` — image upload handling
- `sharp` — image processing/optimization (WebP, resize, multi-size)
- `cors`, `dotenv`, `helmet` — essentials
- `@sentry/node` — error tracking
- dev: `typescript`, `tsx`, `@types/*`

### admin/
- `next`, `react`, `react-dom`
- `tailwindcss` + `shadcn/ui` — styling & components
- `@tanstack/react-table` — data tables (products, inventory)
- `@tanstack/react-query` — API data fetching & caching
- `react-hook-form` + `zod` + `@hookform/resolvers` — forms & validation
- `@dnd-kit/core` — drag-to-reorder images
- `lucide-react` — icons
- `zustand` — light state management (if needed)
- `next/image` — image display/optimization
- `next-intl` — UI translations (ar / en / he)
- `@sentry/nextjs` — error tracking

### pos/
- same base as admin (`next`, `tailwind`, `shadcn/ui`, `@tanstack/react-query`, `react-hook-form`, `next-intl`)
- `html5-qrcode` — camera barcode/QR scanning (fallback: `@zxing/library`)
- distinct UI: fast screen, large buttons, instant search

### shared/
- `zod` — shared type/schema definitions imported by all projects

---

## Seed data (dev/testing)
A `backend/prisma/seed.ts` provides idempotent test data (run: `npx prisma db seed`).
It must be **idempotent** (upsert-based, safe to re-run) and **dev-only**. It covers every rule:
- one user per role (admin/manager/employee @organza.test, password `password123`)
- global variant types + values in ar/en/he (Color, Size, Number)
- nested categories (Women > Dresses > Evening; Women > Abayas)
- a simple product, a 1-option product, and a 2-option cartesian product
- a variant with a price override + variants that inherit price/cost from the parent
- a compare-at price, an out-of-stock variant, a hidden product, a soft-deleted product

## Build order (for Claude Code — one stage at a time)
1. `backend/` — Prisma schema + migrations + seed (`prisma/seed.ts`, idempotent, covers all rules).
2. Auth (JWT) + role middleware.
3. Products + variants CRUD + variant generation logic + SKU generation.
4. Categories (nested) + images (upload + sharp optimization + reorder).
5. Variant types (global + inline add) endpoints.
6. Audit log wired into all mutations.
7. `admin/` UI on top of the API.
8. `pos/` screen + scanner.
**Test each stage before moving to the next.**

---

---

## Planned feature: Numbered shawls (variant-based, deferred)
A way to sell shawls over WhatsApp: one product per collection with a **single image** showing all
colors, and **numbers drawn on the image**. Each number is one purchasable item with its own
stock/price. Send one numbered image on WhatsApp; the customer replies with a number.

**Design — reuses the EXISTING variant system (no new product type):**
- The "الأرقام / Number" variant type already exists (global, like Color/Size). A numbered shawl is
  just a normal product using the **Number** variant type: choosing numbers 1–6 generates variants
  1–6 exactly like any other variant. Stock, price (+ override), SKU, barcode, audit — all reused
  as-is, already built and tested.
- **Which kind a product is, is explicit — `Product.isNumbered` (boolean, default false).** It is
  chosen up front in the product form, never inferred from the variant types the product happens to
  use. The two shapes never mix, and the backend enforces it (not just the UI): a numbered product
  accepts the **Number** type and nothing else, an ordinary one accepts everything **except**
  Number. Changing the answer on a product that already has variants is **refused**
  (`error.product.numbered_switch_has_variants`) — the variants have to be removed first, nothing is
  deleted on the user's behalf. The flag is also what the numbered-points editor, the list badge and
  the POS parent-barcode scan all branch on.
- **New fields on Variant (optional):** `imageX` and `imageY` (percentages, nullable). When set,
  the variant is a point on the product image; when null, it's an ordinary variant. Percentages
  (not pixels) so points stay correct at any screen size.
- Numbers are unique within a product (the variant set already guarantees this).

**Display:** product image as background; numbers drawn on a separate transparent overlay (small
circles) using each variant's `imageX/imageY`. Full image visible with numbers on top.

**Admin input (two-step, to avoid mis-linking):**
1. Place points on the image first — auto-numbered 1, 2, 3… (creates the Number values/variants).
2. Review/drag/delete misplaced points BEFORE committing.
3. Then set quantity (and optional price) per number.
4. Persist only on an explicit **Save** (no autosave). Deleting a number asks for confirmation.

**WhatsApp export (automatic):** render the image + numbers "burned in" into one shareable copy via
`sharp`, regenerated when points change — one workflow yields both a WhatsApp-ready numbered image
and the interactive stock-linked variants inside the system.

**Critical technical note:** on click, coordinates must be computed relative to the **displayed
image's** dimensions, not the screen/viewport — otherwise numbers drift.

**Deliberately omitted (simplicity):** for these products, no sizes/colors — just the Number variant
type + quantity (+ optional price) per number.

---

## Phase 2: Orders

### Channel (where the sale came from)
Every order records its **channel**: `STORE` (sold in the shop via POS), `WHATSAPP`, or `WEBSITE`.

### Status flow
- **STORE (in-shop sale):** completed immediately — a direct sale, no pipeline at all.
- **Online (WHATSAPP / WEBSITE):** `NEW` → `PREPARING` → `HANDED_TO_COURIER`
  ("تم تسليمه لشركة التوصيل"), which is the **final** state.
- Plus `CANCELLED` and `RETURNED`.

**Why it ends at the handover.** The shop's involvement in an online order stops when the parcel
is given to the delivery company — it does not track the drive to the customer's door, and nobody
in the shop is in a position to know when the customer opened the door. So there is no `RECEIVED`
state to keep up to date, and no separate `DELIVERING` step: "packed" and "gone" are the only two
facts the shop can actually record, and the handover is the second of them.

A parcel the customer refuses comes back through the **returns** flow, not as a cancellation, so
the stock and the money move together. `CANCELLED` is reachable from `NEW` and `PREPARING` only —
before the parcel has left. There is deliberately no `HANDED_TO_COURIER → COMPLETED` move:
`COMPLETED` belongs to a counter sale, which opens there, and reporting counts the two finished
states together rather than chaining them.

### Customer information
Customers are still **deferred as an entity** — there is no `Customer` table. Instead, customer
details are stored **directly on the order** (a snapshot):
- **STORE:** no customer info needed (all fields empty).
- **WHATSAPP / WEBSITE:** capture name, phone, and location/address info (optional map coordinates).
This keeps Phase 3 (real customer accounts) open without blocking orders now.

### Payment
**Cash only** for now, but modeled as a field (`paymentMethod`) so more methods can be added later.

### Payment collection (money arrives later)
Selling and being paid are **two different moments** in this shop, and conflating them is what
makes profit figures lie. A counter sale is cash in the till. An order handed to the delivery
company is money that company holds — sometimes for weeks — and hands over in a batch later.

So every order carries a **payment status** alongside its order status:

- `paymentStatus`: `PENDING_COLLECTION` | `COLLECTED`, plus a `collectedAt` timestamp.
- **STORE sales are `COLLECTED` on creation** — the cash is in hand at the till.
- **Online orders stay `PENDING_COLLECTION`** until an **Admin/Manager** records that the delivery
  company has settled up. An Employee may take the sale and hand it over, but **must not** be able
  to declare its money received (`order.markCollected`, enforced on the backend — the same
  anti-theft reasoning behind cancel/delete).
- Marking an order collected is **idempotent**: doing it twice is a no-op, not an error, so two
  people settling the same batch at once can't produce a failure. Every collection writes an audit
  entry (`PAYMENT_COLLECTED`), so "who said this money arrived" is always answerable.
- A **cancelled or fully returned** sale owes the shop nothing, so it is excluded from the
  outstanding view and total even though it was never collected.

**Admin view — money with the delivery company.** A dedicated screen lists every order still
awaiting payment, oldest first (the money owed longest is the money to chase), with the total
owed, how many orders it is spread over, and the date of the oldest one. Orders are ticked off
with checkboxes and settled **one or several at a time** in a single action.

The outstanding total is computed from the same per-line figures the reports use — net of returns,
cancelled sales excluded — so the orders screen and the reports screen can never quote different
amounts for the same sales.

### Discounts
Supported at **two levels**: per **line item** and on the **order total**. Each stores its type
(percentage or fixed amount) and value.

### Stock deduction
- **STORE:** stock is deducted **immediately** at sale.
- **Online:** stock is deducted when the order moves to **PREPARING**.
- An order records when its stock was deducted, so it's never double-deducted.

### Returns
Returns are supported: an order (or specific items with quantities) can be returned, which
**restores stock** and is recorded in the audit log.

### Reports: sold vs. collected
Sales reporting must never let "what we sold" be read as "what we hold". Every totals block
therefore splits revenue three ways:

- `revenue` — what was sold (net of both discount levels and of returns);
- `collectedRevenue` — the part actually paid for;
- `pendingCollectionAmount` (+ `pendingCollectionOrderCount`) — the part still owed by the
  delivery company.

The two parts always add back up to `revenue`. Profit is unaffected by *when* the money lands —
it is a sales figure — but the pending total sits next to it so the shop can see the difference
between a good month and a month that has been paid for. These are sales figures rather than
costs, so every role that may read the block at all sees them — the Reports screen is Admin only
and the dashboard is Admin/Manager, while cost/profit/margin stay **Admin only** inside both, per
the sensitive-fields rule.

### Price & cost snapshots (important)
Each order item stores a **snapshot** of the unit **price** and unit **cost** at the moment of sale.
Prices and costs change over time, so profit reports must use what was true at sale time, not the
product's current values. This is what makes the sales/profit dashboard accurate.

### Roles (already defined in the permissions layer)
Employee can **create** orders and advance them as far as the courier handover, but **cannot
delete, edit, or cancel** them, and **cannot mark their money collected** (anti-theft).
Admin/Manager have full control. Every mutation writes an audit entry.
---

## Cash drawer & expenses

Orders answer "what did we sell". They do not answer the two questions the shop actually closes
the day on: **is the money in the drawer right**, and **what did we spend**. Without those, a
"profit" figure is just revenue minus the cost of goods, which is not what anyone gets to keep.

### The cash drawer (one session per trading day)

A session opens with the float left in the drawer the night before, takes in the day's cash sales,
pays out the day's cash expenses, and is closed by **counting what is actually there**:

```
expected   = openingFloat + cash sales − cash expenses
difference = counted − expected            (negative = short, positive = over)
tomorrow's openingFloat = counted − withdrawn
```

- **Admin and Manager only**, both reading and writing. The count *is* the shop's cash position,
  so the person standing at the till must not be the one who declares what should have been in it
  — the same anti-theft reasoning as "mark money collected".
- **Cash sales** are sales paid in cash whose money was actually *collected* inside the day's
  window. A counter sale counts the moment it is rung up; a courier order counts on the day the
  delivery company settles it, because that is the day the notes reach the drawer. Computed from
  the same per-line view the reports use, so the drawer and the reports can never disagree.
- **Cash expenses** are approved expenses marked `paidInCash`, dated inside the window. A card or
  transfer expense is just as real a cost, but the drawer never held that money.
- **Closing records the count and any withdrawal.** What is left (`counted − withdrawn`) becomes
  the next day's opening float **automatically** — nobody has to remember a number overnight. Note
  it carries the *counted* figure, not the expected one: the next day opens on the money that is
  really there.
- **A difference is never a reason to refuse the close.** The money in the drawer is a fact, and a
  system that won't record it only teaches people to fudge the count. It is always saved. What *is*
  required is a **note** explaining it, and the shop may **carry it forward** as a follow-up
  reminder that stays on the list until someone signs it off. Carrying moves no money — the next
  day already opens on what was counted — it is purely the reminder that a day did not add up.
- **The count is blind.** The closing screen deliberately withholds the expected figure while the
  money is being counted: a count made with the answer in view is not a count, it is a chance to
  make the drawer agree with the books. Expected, counted and the difference are revealed together
  the moment a count is submitted — and only then is the note asked for, because only then is there
  a difference to explain. (Mechanically: the close endpoint refuses an unexplained difference and
  returns the three figures with the refusal, so the screen can reveal them without ever having
  been told the answer in advance. The count itself is fixed once revealed.)
- **One drawer per day**, and that is the only restriction. Yesterday's session still being open
  does *not* stop today's from starting: money is attributed to a day by that day's window, never
  by "whichever drawer happens to be open", so nothing can be double-counted — and refusing to let
  the shop trade because someone forgot to count last night is exactly the kind of block this
  feature rejects everywhere else. An uncounted day stays visible as an open session in the list.
- Opening, closing and signing off a follow-up each write an audit entry.

### Expenses

- **Anyone may record one** — whoever pays the electricity bill should be able to write it down
  there and then. But an expense recorded by an **Employee opens as a pending approval** and counts
  for nothing (not against the drawer, not against profit) until it is approved. An Admin's or
  Manager's own expense is approved as it is written, since they hold `expense.approve` and could
  approve it anyway. Rejected expenses stay on the record, with who turned them down and why.
- **The approval itself is an ordinary change request** (see "Employee change approvals"): the
  expense's `approvalStatus`/`approvedBy` columns are the *applied* state — which every money
  query still filters on — while the thing an Admin acts on lives in the one approval flow the
  whole shop uses. Deciding it is **Admin only**; a Manager records spending that counts
  immediately, but does not sign off somebody else's.
- **Only approved expenses count**, and **only `paidInCash` ones move the drawer**.
- Each expense carries a **category**, an **amount**, the **date the money was actually spent**
  (not when the row was written — a bill paid on the 30th and entered on the 2nd belongs to the
  30th), a note, `paidInCash`, and **recurring vs one-off** (a label: rent and salaries recur,
  a new mannequin does not — nothing is generated automatically).
- Expenses soft-delete, like orders: a financial record is hidden, never destroyed.

### Expense categories

The shop's own list, not an enum — seeded with **utilities, salaries, supplies, maintenance,
delivery** and extendable from the admin. Identity is a stable `key`; the display name is
translatable, so renaming it in three languages can never orphan a past expense. Every role may
*read* the list (picking one is part of recording an expense); changing it is Admin/Manager. A
category with expenses filed under it cannot be deleted — retire it instead, so the past keeps
making sense.

### Gifts

Stock walks out of the shop for nothing more often than a system likes to admit: a piece for a
relative, a replacement after a complaint, something thrown in with a wedding order. That is an
order of type **`GIFT`**.

- Created **from the POS, by Admin/Manager only**. An Employee who could file a sale as a gift
  could walk out with the piece.
- It is a **type, not a channel**: a gift is still handed over at the counter, so it keeps the
  `STORE` channel. Keeping the two axes apart is what lets reporting drop gifts out of sales
  without also dropping the STORE channel.
- It **deducts stock through exactly the same machinery** as a counter sale, and is audited the
  same way.
- Every line is **priced at zero** — not discounted 100%. A discounted line is a sale that earned
  less; a gift earned nothing, and keeping them apart stops a month of giveaways from reading as a
  month of generous discounts. Only `unitCost` survives on the line.
- It is **excluded from sales entirely**, and what it cost the shop is **subtracted as a cost of
  doing business** (alongside expenses), not as cost of goods sold.

### Reporting: the money states, stated explicitly

Every totals block already splits revenue three ways (see "Reports: sold vs. collected"). The
profit block on the sales report takes that the whole way, and is **Admin only** because every
figure in it is derived from cost:

- `sold` — what left the shop, net of both discount levels and of returns;
- `received` — the part actually paid for;
- `owed` — the part the delivery company is still holding (+ how many orders it is spread over).
  `sold = received + owed`, always.

and two profits, each given **for all sales and for the received part alone**, because a good month
and a month that has been paid for are different months:

```
gross = sales − COGS
net   = gross − approved expenses − gifts at cost
```

Expenses are subtracted in full from the received-only net too: a bill is owed whether or not the
delivery company has settled up yet. Sold lines whose product had no cost recorded at the time of
sale are surfaced as `missingCostItems`, because they count as zero and quietly make both profits
look better than they are.

### The admin dashboard

Figures only — **no chart**. The people reading it are standing at a counter with a phone in one
hand, and what they need is a number they can act on, not a trend to interpret. Four sections, in
the order of the day: **Today → Cash drawer → a period (today / this week / this month, with an
Excel export) → Needs attention** (low stock, expenses awaiting approval, money uncollected from
the delivery company).

Two rules govern the wording, and they are what the whole screen is for:

- **Never one vague "revenue".** Every block says *Sold*, *Received* and *Still owed* separately,
  with "still owed" in a warning tone so it can never be mistaken for takings.
- **Never one vague "profit".** Profit is always given twice — on all sales, and on the received
  part alone — so it is never ambiguous whether the money is actually in hand.

The drawer is shown as the sum it is, line by line, so that when a count disagrees it is obvious
*where* the expectation came from. Every label carries a **(?)** that expands a plain-language
explanation inline beneath it — tapped, not hovered (there is no hover on a phone), and in normal
flow so it can never clip at the edge of a narrow screen.

Cost and profit cards are Admin only. A Manager's dashboard does not render them empty — the
figures are absent from their payload, so the cards simply aren't there.

---

## Sale notifications (Web Push)

The owner is not at the counter all day, and the question they actually want answered is
"what has been sold while I wasn't there". So a sale rung up by a **Manager** or an
**Employee** pushes a notification to the **Admins'** phones.

- **Nobody is told about their own sale.** An Admin who rings something up at the counter
  was standing there; being told what *someone else* sold is the whole point.
- **Transport is the free Web Push standard** — the browser's own push service delivers it,
  identified by a VAPID key pair the deployment generates once. No paid notification
  service, in line with the hosting rules.
- **Devices opt in, one at a time.** An Admin turns notifications on from the admin's
  Settings screen, on each phone they want them on. On iPhone and iPad the app must first be
  added to the Home Screen — Safari only allows notifications for an installed app — which
  the screen says in plain words, alongside the permission the browser actually holds.
- **The notification is short and plain:** what was sold, the total in the store currency,
  and who sold it — e.g. "بيع جديد: فستان سهرة — ٢٥٠₪ — أحمد". Tapping it opens that order
  in the admin. It is translated like every other string; the API sends translation keys and
  figures, never a sentence.
- **A notification can never cost a sale.** Sending happens after the order is committed and
  is never awaited: a push service that is slow, unreachable or has forgotten the device
  changes nothing about the sale, and the failure goes to error tracking rather than to the
  person at the till. A subscription the push service reports as gone is cleaned up.

### Settings
Two store-wide settings (Admin only), on top of the per-device opt-in:

- an **on/off switch** for sale notifications;
- a **mode**: `EVERY_SALE` today, with `ABOVE_AMOUNT` (only sales worth at least a set
  figure) and `PERIODIC_SUMMARY` (one digest instead of one notification per sale) modelled
  now so they can be added later without a migration or a redesign. The stored minimum
  amount is kept in every mode, so switching modes never loses the figure the shop chose.
