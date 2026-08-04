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
- `category` (nested categories supported: e.g. Women > Dresses > Evening)
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

## Barcode (auto-generated)
- **Every product and variant gets a system-generated, unique barcode** (not scanned from the item,
  not the SKU). Use a standard format (**EAN-13**) so any scanner/label printer works.
- Generated once at creation and unique across the store.

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
- **`cost`** (purchase cost): visible to **Admin + Manager only**. Never returned by the API to
  Employees — enforced on the backend, not just hidden in the UI.
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

## Roles & Permissions
Three fixed roles.

| Capability                        | Admin | Manager | Employee |
|-----------------------------------|:-----:|:-------:|:--------:|
| POS — make sales                  |  ✅   |   ✅    |    ✅    |
| Add products                      |  ✅   |   ✅    |    ✅    |
| Edit product images               |  ✅   |   ✅    |    ✅    |
| Edit product details/price/stock  |  ✅   |   ✅    |    ❌    |
| **Delete** product                |  ✅   |   ✅    |    ❌    |
| **Hide / publish** product        |  ✅   |   ✅    |    ❌    |
| Create order + mark delivered     |  ✅   |   ✅    |    ✅    |
| **Delete / edit / cancel** order  |  ✅   |   ✅    |    ❌    |
| Manage stock (full)               |  ✅   |   ✅    |    ❌    |
| Manage users                      |  ✅   |   ❌    |    ❌    |
| Settings                          |  ✅   |   ❌    |    ❌    |

**Security rationale:** Employee can create and deliver orders but **cannot delete or edit them**,
so a sale can't be erased to cover theft. Every action is tied to its author via the Audit Log.

---

## Soft delete
Products are never hard-deleted (they may be linked to past orders). Deleting sets `deletedAt`
and hides the product from all normal views. Role-gated (Manager/Admin only).

---

## Audit Log
Every meaningful action is recorded: who (`userId`), what (`action`), on which entity
(`entityType` + `entityId`), and the `oldValue` / `newValue`. Covers create/update/delete,
publish/hide, stock changes, and price changes.

---

## Admin dashboard — what's available
- **Dashboard:** today/month sales summary, top products, low-stock alerts
- **Products:** add/edit/delete, manage variants & options, upload/reorder images, categories
- **Inventory:** per-variant quantities, manual adjust, low-stock threshold alerts
- **Categories:** nested category management
- **Reports:** sales by period / by product / best sellers
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
- **STORE (in-shop sale):** completed immediately — a direct sale, no delivery pipeline.
- **Online (WHATSAPP / WEBSITE):** `NEW` → `PREPARING` → `DELIVERING` → `RECEIVED`.
- Plus `CANCELLED` and `RETURNED`.

### Customer information
Customers are still **deferred as an entity** — there is no `Customer` table. Instead, customer
details are stored **directly on the order** (a snapshot):
- **STORE:** no customer info needed (all fields empty).
- **WHATSAPP / WEBSITE:** capture name, phone, and location/address info (optional map coordinates).
This keeps Phase 3 (real customer accounts) open without blocking orders now.

### Payment
**Cash only** for now, but modeled as a field (`paymentMethod`) so more methods can be added later.

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

### Price & cost snapshots (important)
Each order item stores a **snapshot** of the unit **price** and unit **cost** at the moment of sale.
Prices and costs change over time, so profit reports must use what was true at sale time, not the
product's current values. This is what makes the sales/profit dashboard accurate.

### Roles (already defined in the permissions layer)
Employee can **create** orders and mark them delivered/received, but **cannot delete, edit, or
cancel** them (anti-theft). Admin/Manager have full control. Every mutation writes an audit entry.