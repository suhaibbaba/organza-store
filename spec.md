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

### Notes on a product's options
A short, optional note written against **this product's use of** one option value.

"S" means something different on a pair of trousers than on an abaya, so the shop writes
"طول البنطلون ٩٥ سم" against the trousers' own S — and something else, or nothing at all, against
the abaya's. The same applies to a colour ("أغمق قليلًا من الصورة") and to a numbered shawl's
numbers ("حرير طبيعي" against number 4).

- **Scoped to the product, never to the global value.** The note lives on the join
  `ProductOptionValueNote (productId, optionValueId, note)`, so writing one can never change what
  another product's S says. The value itself is still referenced by id (the reference rule above):
  renaming "أحمر" centrally renames it everywhere and leaves every note where it was.
- **Translatable `{ ar, en, he }`** like all user-facing content, falling back to the default
  language. Blank in every language is not a note — the row is removed, so "does this value have a
  note" is one question with one answer.
- **Short by design** (`OPTION_VALUE_NOTE_MAX_LENGTH`): it is read on a picker tile between two
  customers, not a second description.
- **Edited in the product form**, beside the values themselves: one collapsed block under the
  options, one language switch for the whole block, one line per value. A numbered shawl's numbers
  are annotated the same way, in the numbers editor's quantities step — a number is an option value
  like any other. It is a product DETAIL, so it rides on `product.edit` exactly like the name: an
  Employee may write one, while their price change in the same save still waits for an Admin
  (see "Employee change approvals"). A note may only be written against a value the product
  actually uses; anything else is refused (`error.product.option_note_value_not_used`).
- **Displayed wherever the value is chosen or shown**, identically for colours, sizes and numbers:
  the POS variant picker, the product detail page, and the storefront's variant selector when that
  is built. Always small and secondary, directly under the value it explains, at most two lines. A
  variant carrying notes from two option types shows one line each, prefixed with the value it
  belongs to so it is obvious which is which; a single note needs no prefix, because the tile is
  already showing the value it explains. A value with no note renders nothing at all — no gap, no
  placeholder, nothing that shifts.
- **Deliberately absent from the crowded places:** cart lines and order lines carry none of this,
  so the selling flow is not slowed by an explanation that belongs where the choice is made.
- **Never drawn on a numbered shawl's photograph.** The markers are tight already, and text over a
  photograph cannot be relied on to be readable — the note goes beside the number in the picker.

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
- Role checks enforced on the **backend** for every protected route.
- Keep auth behind a thin wrapper so plugins (OTP/passkey for customers) slot in later.

### Passwords: nobody is handed one

There is still **no public sign-up** — an Admin creates every staff account. But an account is
created with **no password at all**, and its owner chooses one from a **single-use, time-limited
link sent to their own mailbox**. So the only person who ever knows a password is the person it
belongs to, and an Admin never has to invent one and read it out across a counter.

- **`PasswordSetupToken`** holds only the **SHA-256** of the emailed token, never the token
  itself, and never writes it to a log. It carries a purpose (`SET` for a new account, `RESET`
  for a forgotten password), an expiry, and a `usedAt` that is written by a conditional update —
  which is what makes a link genuinely single-use rather than single-use-if-nobody-double-clicks.
- **A link lasts 72 hours for a new account and 2 hours for a forgotten password.** A new member
  of staff may not open their mail until the next shift; somebody who has just clicked "I forgot"
  is dealing with it now.
- **Issuing a link kills the previous one.** Otherwise an Admin's reset would leave a link that
  had already gone astray still working.
- **Redeeming one signs every device out** and marks the email verified. If the reason for the
  reset was that somebody else had the old password, leaving their session alive would make the
  reset decorative.
- **The password is written through Better Auth itself**, never by hand. The hash lives on the
  credential `Account` row, and sign-in reads it back with Better Auth's own verifier against
  *every* credential row it finds — so the password is hashed with `ctx.password.hash` and stored
  with `ctx.internalAdapter`, rather than with a hasher imported on the side and a row picked by
  our own query. The three ways those two ends could disagree — a different hash format, a row
  Better Auth does not consult, and a second stale credential row shadowing the fresh one — are
  then not things the code is able to express. A password that is set and then rejected at sign-in
  is the worst failure this flow has, because everything on screen says it worked.
- **The public "email me a link" endpoint reveals nothing.** Known address, unknown address,
  deactivated account: the same status and the same body every time — anything else turns the
  form into a way of asking whether somebody works here. It is rate-limited **per address** (the
  real defence against mail-bombing and probing) and, more loosely, per caller, since the whole
  shop shares one public address. Unknown, expired, already-used and revoked links all answer
  with the same single error key, for the same reason.
- **"I forgot my password" is on both login screens** — the admin's and the POS's. Somebody who
  cannot sign in cannot sign in to ask, and the till is where they discover it. Both post to the
  same public endpoint and show the same neutral confirmation whether or not the address exists;
  the link itself always lands on the admin app's set-password screen, since that is the address
  the backend builds it from, so there is no second copy of that screen to keep in step.
- **The Users screen says who has finished setting up.** An account is created with no password,
  so "added, but has never signed in" is an ordinary state and used to be invisible: a link that
  went to a mistyped address looked exactly like one that had been used. Each row therefore
  carries whether a password exists at all (`hasPassword` — the fact, never the hash, the length
  or when it was set), shown as a "password not set" badge beside the active/inactive one. They
  are different questions: one is whether the account is ALLOWED to sign in, the other whether it
  CAN yet.
- **An Admin can send anyone a fresh link** from the Users screen. The link is shown to them as
  well as emailed — an Admin already holds unrestricted password authority over every account, so
  it grants nothing new, and it is what lets the shop pass a link on over WhatsApp when a mailbox
  is unreachable. For somebody still pending that button **re-sends the invitation** (a `SET`
  link, 72 hours, "choose your password"), and it is refused once the account has a password:
  re-inviting somebody who has finished would quietly be a password reset, which is a different
  decision and has its own button.
- **Being refused for trying too often must not read as "wrong password".** Better Auth
  rate-limits sign-in, and its own default — three attempts per ten seconds, per client IP, or
  for *everybody at once* when no trusted client address can be resolved behind the proxy — is
  spent by ordinary use: somebody who has just chosen a password, mistypes it twice on a phone
  keyboard and then types it correctly is refused on the attempt that was right. The window is
  therefore widened to something a person cannot reach by hand but a script still trips over, and
  both login screens say "too many attempts, wait a moment" on a 429 rather than repeating the
  bad-credentials message.
- **The admin-set password stays as a fallback**, for exactly that case.

**Email is transactional and must not be able to cost anything.** It goes out through one
swappable provider (Resend today) behind a small service, **after** the write it belongs to has
committed, and is **never awaited**: a mail provider that is slow, unreachable or has had its key
rotated must not turn "the account was created" into a failure. A send that fails goes to error
tracking, exactly like a sale notification. With no provider configured, mail is simply not sent
and the log says so.

**The templates live in the codebase, not in a provider's dashboard** — version-controlled,
reviewable, and translated through the same per-language message files the rest of the system
uses (ar default, en, he), with `dir="rtl"` and a legible Arabic font stack. They are branded in
the Organza palette, carry the logo, one obvious action button and the raw link underneath it as
a fallback, and are written as email HTML rather than web HTML: tables, inline styles, nothing
Outlook cannot render, a real plain-text alternative, a subject and a preheader. They carry **no
tracking pixel and no rewritten links** — both make a transactional mail look like marketing to
the filters, and the link in this one has to arrive. They are sent from a no-reply address on the
verified domain, with a **reply-to that reaches the shop**, because somebody replying to it is a
person trying to get hold of the shop.

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

## Editing a photograph on upload

A phone photograph of stock is a room with a dress in it. The shop frames the
garment itself, in the admin, at the moment the photo is added — otherwise the
catalogue is a grid of dresses at different sizes with different amounts of
shop around each of them.

**The editor** (`react-easy-crop`, touch-first) opens by itself the moment
photographs are chosen, one after another for a batch, without going back to
the form in between. It does four things and no more: drag to move, pinch or
drag the slider to zoom, turn in quarter steps, mirror. It works by touch and
by mouse — the counter screen has no pinch, so the zoom slider is not
decoration.

**The shape is the catalogue's 2:3 by default**, so every product photo comes
out the same shape. The other choice is the photograph's own shape, for the
piece that genuinely does not fit — a display, a fabric detail. **Skipping the
editor is still a supported way to add a photo:** it is stored whole, exactly
as before, and the screens that draw it letterbox it on the photo plate.

**The edit is DATA, never a picture.** What the browser sends is the file as
it was picked plus a rectangle (fractions of the framed view), a quarter turn
and two mirrors; `sharp` cuts the three stored sizes out of the **original**,
at full quality. A canvas re-encode in the browser would hand the server a
photograph already decoded, scaled to fit a phone screen and re-compressed,
and no care afterwards puts that detail back. The preview drawn on the tile is
a canvas — a preview is all it is.

**The original is kept** beside the three sizes (`<uuid>-original.<ext>`,
untouched bytes), so a framing chosen in a hurry can be reconsidered: a stored
photo carries a **crop** button that re-cuts it from the original, and the new
sizes get new file names so nothing cached anywhere goes on showing the old
framing.

**A photo from before the editor existed can be re-framed too.** It has no
original, so the largest size it does have is used — and then **promoted** to
be that photo's original as the crop is cut. One step down in quality, once,
from a picture that had already been through sharp; from then on it behaves
like any other photo and never loses anything again. The alternative — telling
the shop to photograph its existing catalogue again, or cutting each new crop
out of the last one — is worse in both directions.

**Orientation is honoured.** A phone held sideways records an EXIF tag rather
than turning the pixels, and every browser turns it back before drawing —
including the one the crop was drawn in — so the server auto-orients before
cutting. Without that pair, a crop drawn on a portrait photo would be cut out
of a landscape one.

**Nothing about a gallery changes otherwise:** photos are still picked,
reordered, made primary and removed in the form's working copy, and written by
its single Save (an Employee's deletion still becomes a change request).

---

## An installed app, not a page in a browser

The admin and the POS are used on a shop counter — a phone in one hand and a
garment in the other — so the browser's default reflexes are wrong for them:

- **Nothing zooms.** An accidental pinch that leaves the screen askew at 1.4×
  mid-sale is not something a cashier with a customer waiting will stop and
  undo. Three things together: `maximum-scale=1, user-scalable=no` in the
  viewport (honoured by Chrome and the Android WebView), `touch-action:
  manipulation` (drops double-tap-to-zoom without touching taps or fast
  repeated taps), and cancelling Safari's `gesture*` events plus any
  multi-touch `touchmove`, because iOS has ignored `user-scalable=no` since
  iOS 10. In the **installed** app that holds; in plain Safari the same
  listeners stop the pinch, but the address bar's own Zoom control is beyond
  any page's reach. The photo editor opts out (`data-allow-zoom`) — pinching
  into a garment is the one place two fingers mean something.
- **Nothing may depend on zooming**, therefore: every label is legible and
  every control tappable at 1× — 16px form fields (below that Safari zooms the
  page on focus, which would strand the layout), a 44px floor on anything a
  thumb hits, and no interface text below 12px.
- **No long-press sheet.** Holding a product card or a button raises iOS's
  Copy / Look Up / Share sheet over the interface, which means nothing here.
  Selection and the callout are off, and back on for the handful of things
  worth copying — a barcode, a SKU, an order number, a customer's phone number
  or address — marked `data-selectable`.

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

## Editable role permissions

The table above is the shop's **starting point**, not its ceiling. Shops differ: one wants its
Employees handling stock, another does not; one wants its Manager printing labels, another keeps
that to the counter. So most of that table is editable from the admin — **and a specific part of
it is not, ever.**

Everything goes through one function, `can(user, action)` in `@organza/shared`, which every screen
and every route already calls. Making the rules editable changed only where that function reads
them from; no call site moved.

### The split

Every action is declared as exactly one of two kinds, next to the action itself in
`shared/src/constants/permissions.ts`. The two lists are exhaustive and disjoint, checked when the
module loads — an action in neither (or in both) is a crash on boot, not a permission that
silently cannot be resolved.

**PROTECTED — never editable, by anyone, through any UI or API.** Fifteen actions, and each of
them is here for one of two reasons:

| Action | Why it cannot move |
|---|---|
| `product.viewCost`, `report.view` | Cost, COGS, profit and margin are the owner's read of their own business (see "Sensitive fields"). |
| `user.viewSensitive` | A staff ID number. |
| `product.editPrice` | "Nothing can be sold cheap and pocketed" is only a guarantee while the re-pricing permission cannot be handed to whoever is at the counter. |
| `order.edit`, `order.cancel`, `order.delete` | A sale, once rung up, cannot be quietly changed, voided or erased. |
| `order.return` | Undoing a sale by another name, so it is protected with the ones above rather than left as the way round them. |
| `order.createGift` | Re-pricing a sale to zero by another name. |
| `order.markCollected` | The person who took the order must never be the person who says its money arrived. |
| `changeRequest.approve` | The approval gate is the whole design; a grantable approval permission is a gate anybody can walk around. |
| `expense.approve` | Self-approval by another name — granted to whoever spends the shop's cash, it takes money out of the drawer with nobody's agreement but their own. |
| `user.manage`, `user.delete` | The keys to the building. |
| `permission.manage` | A permission to hand out permissions that could itself be handed out is not a gate, it is a door with the key taped to it. |

These are the **anti-theft guarantees** the "Security rationale" above is built on, plus the two
things a shop cannot recover from on its own: somebody reading the owner's margin, and an Admin
locked out of their own system. If they can be switched off, the whole design collapses.

**CONFIGURABLE — everything else** (thirty actions): adding and editing products, categories,
photos, option values, reading and adjusting stock, printing labels, taking and following orders,
the cash drawer, recording and reading expenses, asking for and reading changes, the dashboard,
and the settings screen. Real decisions a shop makes about itself, that cost nothing if they turn
out wrong and are put back with one tap.

### Where the rules live

- **PROTECTED** actions are answered from the shipped table (`DEFAULT_ROLE_PERMISSIONS`) and from
  nothing else. No stored row, no API call and no hand-edited database moves one.
- **CONFIGURABLE** actions are answered from the `RolePermission` table — one row per
  (role, action), holding an explicit on/off.

A row that is **missing** means "nobody has decided", and falls back to the shipped default. That
is what makes an action added in a later release behave as it was written on a database
bootstrapped before it existed, rather than arriving switched off for everybody, silently.

`npm run bootstrap` seeds the table from the shipped defaults, each grant **once in the life of
the database** like every other bootstrapped default — so day one behaves exactly as it did before
this screen existed, and a shop's own decision is never undone by a later deploy.

### Why it is cached, and how it stays honest

`can()` is called dozens of times per request and is synchronous — it is an `if`, everywhere.
A database read per call is not an option, so each API process holds the table in memory
(`backend/src/lib/permissionConfig.ts`):

- the process that **makes** a change re-reads immediately, inside the request that made it, so
  whoever just tapped the box is never shown the state they replaced;
- every **other** process checks a *version* rather than the table — a digest of the whole
  (role, action, granted) set, one row back, asked for at most once every few seconds on the way
  through `requireAuth`. Unchanged (the normal case) it does nothing; moved, it re-reads once.
  A digest rather than a timestamp, because a timestamp is only as precise as its column and two
  edits inside one millisecond would leave a process convinced nothing had changed.

If the database cannot be reached, the last good rules stay in force and the failure is reported.
Permissions a few seconds old are a working shop; permissions that evaporate because a query timed
out are a shop where nobody can sell anything.

The admin and POS apps are handed the same rules from `GET /api/permissions` and push them into
their own `can()`, so what a screen shows and what the API allows cannot disagree. That is
convenience, not a boundary: the backend refuses the request whatever the browser believes.

### The guards

1. **Only an Admin may edit** — `PATCH /api/permissions` is gated on `permission.manage`, which is
   PROTECTED and Admin-only, so it can never be granted to another role.
2. **An Admin may not edit their own role.** The one edit whose author and subject are the same
   person, refused outright (`error.permission.self_role`) — including for a change that would be
   harmless, because the rule is about who is adjusting whose authority, not about what the edit
   happens to amount to.
3. **The last active Admin cannot be stripped.** Demoting or deactivating them is refused
   (`error.user.last_admin`), and guard 2 closes the other road to the same place: no sequence of
   permission edits can take anything away from the account holding the shop together.
4. **A PROTECTED action is refused by the server** (`error.permission.action_protected`), not
   merely hidden on the screen — a `curl` with an Admin's token is a client too. A batch naming
   one is refused whole, so "refused" can never mean "half of it landed".

Every change writes an audit entry of its own — who, which role, which action, on or off
(`PERMISSION_GRANTED` / `PERMISSION_REVOKED`) — rather than one entry per request carrying a blob,
because the question somebody will ask this trail is "when did Employees get this?".

### The screen

Admin → **Permissions**. On a phone: pick a role, then plain switches grouped by the part of the
shop they belong to. On a desktop: the actual matrix, actions down and roles across.

A protected row shows a **padlock and a short reason** — "this protects the shop's records" —
never a greyed-out checkbox. A disabled control is the universal look of something broken; an
untrained user taps it three times and concludes the app is faulty. The padlock says the opposite:
this is working exactly as intended, and here is why it will not move. The Admin's own column is
locked the same way, and still says whether the grant is on, because "what can an Admin do" is a
question the screen exists to answer.

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

## Quick sell

At the height of the season, stock reaches the shop floor before it reaches the system. A customer
is holding a piece that nobody has entered yet, there is a queue behind them, and the honest choice
is between selling it and writing it on paper. So the POS sells it.

**Sell first, tidy up later.** A cashier taps *Quick sell* and types what the sale genuinely needs:
a **name**, a **selling price**, and optionally one short **colour / size / number**. No category,
no cost, no barcode, no photograph, no variants. The line joins the cart like any other, discounts
and totals the same way, and the sale completes **immediately** — nothing about it waits for
approval, and stock behaves exactly as it does for any other sale.

**What the sale creates.** In the same transaction as the order:

* a **Product**, deliberately incomplete — `categoryId` null, `cost` null, no images, no variants,
  `isActive` false (it has no business being browsed to yet), a barcode of ours so the piece can be
  labelled the moment somebody shelves it, and `stock` equal to what is leaving, so the sale's own
  deduction lands it at zero. `quickSoldAt` is stamped.
* an **OrderItem** with `quickSold` true and `unitCost` **null** — nobody at the till knows what the
  piece cost.
* a **ChangeRequest** on `(Product, completion)`, through the same mechanism as every other gated
  change (CLAUDE.md rule 21). No second `approvalStatus` column anywhere.

Because all three commit together, an abandoned or failed checkout can never leave a nameless
half-product behind.

**The request reads the other way round.** Every other request on the approvals screen asks
permission *before* the fact. This one is a review *after* it: the sale has happened and the money
is in the till. So it gets a card of its own that says what happened first — "already sold for
150 · order 412" — and offers *Complete the details* and *It was a one-off* rather than approve and
reject. Getting that wrong would invite the conclusion that refusing undoes a sale.

**Completing** is done on the product's own edit form, where the missing half actually lives: the
approvals card links there, and a banner at the top of that form carries the two decisions. A
category is required — a product without one is invisible to every category-filtered list, which is
the one thing completing must not leave undone (`error.product.completion_incomplete`, refused
server-side). Cost, barcode and photographs stay optional: plenty of real products have no
photograph, and cost is Admin-only, so a Manager may complete a piece and leave it blank.
Completing stamps `completedAt` and publishes the product.

**One-off** stamps `oneOffAt` and soft-deletes the product: a piece that will not come back is not a
catalogue item. **The sale is untouched either way** — the order lines are snapshots
(see "Price & cost snapshots"), so the receipt, the totals and the reports keep saying exactly what
was sold and for how much.

**Profit is visibly overstated until the cost is filled in.** A quick-sold line's `unitCost` is
null, which is precisely what the reports' existing missing-cost warning counts — so the figure
says so out loud rather than quietly reporting the whole price as profit.

**Finding them again.** The sale carries `hasQuickSale`, badged in the orders list and on the order
itself (and per line, since an order of six may have one), with a filter for "quick sales only".
The catalogue side has the **needs completing** queue: a tab on the products screen, carrying its
own count, listing exactly the pieces that are quick-sold and not yet decided. It has to be a tab
rather than a filter inside the sheet, because these products have no category — the filter
somebody *would* reach for cannot see them. Rows carry an "incomplete" badge wherever they appear.

**Permissions.** `product.quickSell` — every role as shipped, which is the point: it happens when
the shop is busiest and that is exactly when an Employee is at the till. `product.complete` —
Admin and Manager; curating the catalogue is not the job of whoever was at the counter. Both are
CONFIGURABLE. Deciding a completion answers to `product.complete` rather than
`changeRequest.approve`, which stays Admin-only and PROTECTED: the two are opposites and widening
one must never widen the other. Quick sell is refused on a **gift** — giving away something the
shop has no record of holding is a piece walking out with nothing behind it.

**Self-review is allowed here, and only here.** An Admin or Manager who quick-sold something may
complete it themselves: they hold `product.complete` outright and could edit that product directly,
so refusing would only strand it on the queue. Every other gated field still refuses a self-decision
— that is what makes the gate a gate.

**The trail.** The order's own CREATE entry records who quick-sold what at what price (every line's
name, price and `quickSold` flag), and the request, the completion and the one-off are audited like
any other change.

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
- `react-easy-crop` — the photo editor (crop / zoom / turn / mirror), touch-first
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

---

## Going live: essential data, not seed data

A shop opening for real needs three things in its database and nothing else: the settings
singleton every screen reads, the global option types a product is built from, and the
categories an expense is filed under. It does **not** need a demo catalogue, and it must never
be given one by accident.

- **`npm run bootstrap` — essential data, on every deploy.** Settings, the three variant types
  with a starting set of values, the five expense categories. Safe to run repeatedly, and
  stronger than merely idempotent: each item is created **at most once in the life of the
  database**, recorded in a `BootstrapRecord` row. An upsert-based version would be idempotent
  and still wrong — the shop retires a colour it never stocks, the next push puts it back, and
  the shop learns the system overrules them. A genuinely *new* default added in a later release
  still lands. An item that already exists (from the old dev seed) is adopted and left untouched.
- **`npm run init` — the real staff accounts, once, by hand.** Never on a deploy. It creates the
  accounts with no password and emails each of them a set-password link, and it **refuses
  outright if any user already exists** — there is no partial mode and no "top up the ones that
  are missing", because a database with a user in it is a database somebody is already using.

  **Who** it creates is a JSON roster read at run time (`staff.json` beside the repo, or
  `--accounts <path>` / `ORGANZA_STAFF_FILE`), never a list in the source. Real people's names,
  addresses and phone numbers are operational data: hiring somebody is not a commit and a
  deploy, and a person's contact details should not sit in git history after they have left. The
  file is git-ignored; a committed `staff.example.json` shows the shape.

  The **whole file is validated before the database is touched** — every missing field, unknown
  role, malformed or duplicate email, invalid or duplicate number (both `+970` and `+972`
  spellings of one line, per the phone rule), and every unrecognised key — and every problem is
  reported at once, naming the entry it is in. Nothing is created until the file is clean: a
  typo in the fourth entry must never leave the first three accounts made, because `init` would
  then refuse to finish the job.
- **`npm run db:reset` — destructive, manual only.** Drops every table, re-applies every
  migration, and deletes uploaded images that no longer belong to anything. It seeds nothing. It
  refuses without an explicit confirmation typed out in full, every run, and needs a second,
  separate declaration when the environment is production.
- **The demo seed is quarantined.** It is not wired to `prisma db seed`, so no migration command
  can trigger it; it is not in the deploy pipeline; and it refuses to run unless told the
  database is disposable — and refuses outright under `NODE_ENV=production`, with no override.

The go-live sequence is therefore: **reset → migrate → bootstrap → init → each person sets their
own password by email → start entering real stock.**

---

## Seed data (dev/testing)
`backend/prisma/dev/demo-seed.ts` provides idempotent test data (run: `npm run seed:demo`, with
the disposable-database declaration above). It must be **idempotent** (upsert-based, safe to
re-run) and **dev-only**. It covers every rule:
- one user per role (admin/manager/employee @organza.test, password `password123`)
- global variant types + values in ar/en/he (Color, Size, Number)
- nested categories (Women > Dresses > Evening; Women > Abayas)
- a simple product, a 1-option product, and a 2-option cartesian product
- a variant with a price override + variants that inherit price/cost from the parent
- a compare-at price, an out-of-stock variant, a hidden product, a soft-deleted product

## Build order (for Claude Code — one stage at a time)
1. `backend/` — Prisma schema + migrations + demo seed (`prisma/dev/demo-seed.ts`, idempotent,
   covers all rules; quarantined — see "Going live" above).
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

**New fields on Product (marker colours):** `pointTextColor` and `pointBackgroundColor` (hex,
nullable). ONE pair for all of a product's numbers, never one per number.

**New field on ProductImage:** `brightness` (0-100, nullable) — how light or dark the photograph
is, measured once by `sharp` at upload and read only to suggest a marker colour.

**Display:** product image as background; numbers drawn on a separate transparent overlay using
each variant's `imageX/imageY`. Full image visible with numbers on top. Three rules hold
everywhere the numbers are drawn — the admin's placement canvas, the product detail page, and the
WhatsApp export — because a shared image that does not match what the shop is looking at is worse
than no image:

- **The photo is capped by HEIGHT as well as width**, keeping its own aspect ratio and staying
  centred. A portrait shawl given a whole desktop column stood taller than the window and pushed
  everything else below the fold. The box always has exactly the photo's ratio, since the points
  are percentages of it, so capping it moves the numbers with the photo rather than off it.
- **A marker is a proportion of the rendered image, never a fixed pixel size** — clamped into a
  readable range, and drawn as a rounded rectangle rather than a circle, because "10" and "12" do
  not sit comfortably in a circle at a size anybody would want to tap. A fixed size is what made
  the numbers crowd each other on a small rendering. The badge stays the size the photo says; a
  finger gets its 44px from an invisible pad around it.
- **The colour is the shop's to choose, and it usually does not have to.** Null on either field
  means "follow the photo": the suggestion is read from the primary image's `brightness`, so a
  black abaya gets white markers and a cream scarf dark ones. Choosing a colour pins it — and it
  deliberately OUTLIVES the photograph, since replacing the image re-measures the suggestion but
  never overwrites a choice. Whatever the pair, the number stays readable: below the minimum
  contrast ratio the TEXT is swapped for black or white (the background is what was chosen to sit
  against the photograph, so it is the half that is kept), and every marker carries an outline in
  its text colour plus a soft shadow so it reads on a busy part of a photograph.

All three live in `shared/` (`constants/numberedShawl.ts`, `lib/pointColors.ts`) rather than in one
app's CSS, so the burned-in WhatsApp copy resolves exactly the same colours.

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
