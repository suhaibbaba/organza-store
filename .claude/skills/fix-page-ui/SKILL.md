---
name: fix-page-ui
description: Rebuild one admin or POS page's layout into the Store Management (clinic) design system. Use when the user names a page/URL to "fix the UI" of, e.g. "fix ar/products/<id>" or "/fix-page-ui orders". Learns: every finished page adds its lessons below.
---

# Fix one page's UI

The apps were first built with their own layouts; they now run on `@store/ui` (the clinic
system's design system, `ui/`). Components were swapped already — this skill fixes **layout and
composition** so each page reads like the clinic app. One page per run.

Reference implementation: the clinic app at `/Users/suhaibbaba/Projects/clinic-management-system/apps/web/src/modules`
(e.g. `patients/pages/patient-page.tsx` for a record, `inventory/pages/item-page.tsx`). Every
`@store/ui` component is on the admin's `/design-system` page.

## Workflow
1. **Look first.** Open the page in the browser (admin :3000, POS :3001, sign in with the
   demo-seed accounts) at 1280px in Arabic; screenshot every scroll position. List what is wrong
   against the patterns below before touching code.
2. **Classify the page** (record / list / form / dashboard …) and find the clinic page of the same
   kind. If the kind has no pattern below yet, or the layout choice is a real product decision,
   ask the user with ASCII previews (AskUserQuestion) — then record the answer below.
3. **Rebuild the layout**, keeping behaviour identical: same queries, mutations, permission gates
   (`can()`), CLAUDE.md rules (cost Admin-only, pending-change badges, rule 23 incomplete badge),
   and every existing `data-test-selector` name. Move things, don't drop them.
4. **Messages:** new keys in all three of `admin|pos/src/messages/{en,ar,he}.json`, real
   translations, no ICU `#`. Props that take keys get full keys (see "Keys vs text").
5. **Verify:** `npx tsc --noEmit` and `npx eslint <files>` in the app; `npm run test -w admin`
   when the shell or a tested file changed. Then the browser again: every tab/state, Arabic and
   English, no console errors, `scrollWidth === innerWidth`. Never click a destructive confirm.
   Test more than one record: one with child rows and one without (a simple product, an empty
   gallery) — the user will open a different record than the one you checked.
6. **Record the lessons** in "Learned so far" (one line each) and add the page to "Done".
   Commit only when the user asks.

## Patterns

### Record page (one thing: a product, an order, a user)
- **Header card** — `<header className="rounded-card border border-line bg-surface p-4 shadow-card">`:
  - start: thumbnail/avatar (`size-14 rounded-panel`), `h1` `text-title font-medium text-primary-900`
    (truncate), badges row under it (`Badge` tones: category `info`, active `success`,
    hidden `neutral`, plus rule-specific badges).
  - end: primary actions as `Button`s (navigation via `<Link className={buttonClassName(...)}>`),
    rare/destructive actions in `RowMenu size="target"` → `MenuItem tone="danger"`.
  - facts: `<dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 lg:grid-cols-4">`,
    each `dt text-value text-ink-muted` / `dd mt-0.5 text-value text-ink`. Codes (SKU, barcode,
    phone) `dir="ltr" tabular-nums` + `SELECTABLE`.
- **Body** — `Tabs` + `TabPanel` with `useTabParam("tab", ids, fallback)` so the tab is in the URL;
  hide tabs that don't apply; `count` on a tab that lists things.
- Collections inside a tab → `Table` (not card grids). Text → `Card p-4`. Nothing → `EmptyState`.
- **Delete** → `useConfirm()` dialog (title key with `{name}`, one consequence line,
  `tone="danger"`), toast on success/failure, never an inline confirm card.
- Back link stays above the header card.
- **Order record — two columns, no tabs** (user, 2026-11-21): an order is small, so everything is in
  view. Header card (number, status/channel/payment/gift/quick-sale badges, facts: date, created by,
  payment method, total; Return as a Button, cancel + delete in the ⋯) above a
  `lg:grid-cols-[minmax(0,1fr)_20rem]` grid: main = pieces `Table` (photo, name, variant, SKU, qty,
  unit price, discount, line total) + totals card; side = status steps + forward button, payment +
  "money received" (`tone: "primary"` confirm), customer (online only), details. One column on phones.

### Form page (create / edit one thing)
- Grid `grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]`: **main** column holds
  the content (info, pricing, photos, child rows); **side** column holds status switches,
  kind/type choices, codes (barcode) and stock/SKU facts. One column on phones.
- Each group is a `Section` (`@store/ui`, modelled on operate-web's `ConfigSection`): coloured icon,
  medium title, one muted description line, `collapsible` with a sliding body, `forceOpen` while a
  field inside has an error. Icon + tone per section live in a constants map, descriptions in
  messages. Related switches share one section split by `divide-y divide-line`.
- Translatable fields use `TranslatedField` (`@store/ui`): one border, a row per language with its
  code in a start gutter, the default language always visible and the rest sliding open under a
  "Translations n/total · Show" bar (modelled on operate-web's `TranslatableField`) — never a
  language switch or three separate inputs.
- Short related inputs sit in a row (`sm:grid-cols-3`), not one per line.
- Save is the clinic `SaveBar` (`@store/ui`), visible only when something changed (always on
  create); Discard remounts the form via a bumped `key` so photos and child rows reset too.
  Outcome alerts (error, held for approval, partial failure) sit at the top and scroll into view.
- The dirty check must cover everything a Save writes, not only react-hook-form fields.
- Editable child rows (variants) are ONE bordered `divide-y` list, not a card grid: identity at the
  start, the most-edited value (stock) inline, price, then a ✎ that opens the rest in a `Drawer`
  (never an inline grey panel); drawer edits still save with the page's SaveBar.
- An "add more" picker opens in a `Drawer` from a secondary `+` button; what it adds shows in the page
  (with its quantity) before Save. Never a grey inline panel, never a checkbox box per group:
  each group is a collapsible `Section` (no icon, `shadow-none`) whose description sums up what is
  picked (at most 3 names, then "+N"); picking a chip is what turns the group on.
  A "select all" is a `Switch size="sm"` at the top of the body, never in the header beside the chevron.
- Lists of child rows (2+) get a small Checkbox per row and a bulk bar on top (select all with
  indeterminate, then the bulk actions the role may do). Bulk actions only stage edits — Save applies.
  One shared bar (`variant-bulk-bar.tsx`) on EVERY list of the same rows — saved and not-yet-saved
  alike; a feature on one list only reads as "missing" on a record that has only the other.
- A `Drawer` closes from its header ✕ only; its footer holds the drawer's own actions or is absent.
- In-row toggles use `size="sm"` (Switch and Checkbox both have it).
- Rows with controls wrap below `sm`: the name gets its own full line (never `truncate`), the
  controls go on the line under it. Check every list at phone width with long names.
- Photo galleries: an auto-fill grid of small 2:3 tiles (`minmax(7rem,1fr)`), "add" is the last
  dashed tile (never a full-width banner), the main photo is outlined + badged, and the tile's tools
  sit in ONE small dark pill bar at the bottom (size-7 buttons), never four big circles.
- The main photo is always the first tile (spec: lowest sortOrder = primary): dragging, ★ and
  delete all keep the two together.
- Full-screen editors: one Save (no duplicate ✓ in the header), controls in a centred `max-w-xl`
  column, Cancel + Save together at the end.
- Counts in messages use ICU plurals; Arabic needs zero/one/two/few/many/other ("سيتم إنشاء 0 متغير" is a bug).
- Anything clickable gets `cursor-pointer` (section headers, row toggles, fold bars).
- No section has its own submit button: everything on the page is written by the one SaveBar.
- Rows being added that carry a quantity (stock) get a `QuantityStepper` per row, before saving.

### List page (many things: inventory, products, orders …) — chosen by the user 2026-11-21
- **Toolbar, one wrapping row:** `SearchField` (`min-w-64 flex-1 sm:max-w-md` — it keeps its width and
  the buttons drop to the next line on phones, never a squeezed "ابحث بالا…"), a secondary **Filters** button
  (sliders icon + a count bubble of active filters), and `TotalBadge` pushed to the end (`ms-auto`).
  Never stacked full-width filter rows or a switch in its own card.
- **Filters live in a `Drawer`:** a draft copied on open, footer "Clear filters" + "Show results";
  each filter is a `FormField`/`Switch` with a one-line hint. Applying resets to page 1.
- **Active filters show as removable chips** under the toolbar: `@store/ui` `Chip` with `onRemove`
  inside a `ChipGroup` (one general Chip — selectable or removable — never a page-local chip).
  Short labels ("Low stock", "Category: X"); counts belong to the TotalBadge, not the chip.
- **Every row shows its photo** before the name — `size-20` on phone cards, `size-16` in the md+
  table (`sizes` says both). The name sits top-aligned with the photo (`items-start`), and the link
  is `inline-flex` around photo + name only, so the empty rest of the row is not a click target.
  The photo identifies the piece, so the list carries no SKU/code column (search still finds codes).
  Phone cards are ONE row, two columns: photo | name + the row's main control (stepper) under it —
  that column is `hideOnMobile` and rendered inside the primary cell with `md:hidden`; the photo is
  its own `tabIndex={-1}` link so only photo + name are click targets: many
  products share a name, so the picture is how the shop tells them apart. A variant row uses its
  own main photo, else the product's — and if the list API doesn't send one, add `thumbnailUrl`.
- Every label/hint comes from `FormField` (label + `hint` keys) or the component's own label prop —
  never a hand-made `<p>`/`<label>` beside a control.
- **Rows:** `@store/ui` `Table` at every width (it renders cards on phones itself); column `header` =
  message KEY; `data-testid` = the old row family so rows keep `<name>-row-<id>`. Status badges sit
  beside the figure they describe — no separate "status" column, no "›" chevrons in cells.
- **Pagination is the Table's own** (`pagination` prop): page numbers + "per page", the size sent
  to the API as `pageSize` and shown from `meta.pageSize`; options from shared `PAGE_SIZE_OPTIONS`.
- **No auto-save on a list.** Inline edits (stock) are staged, outlined while changed, and written
  together by a sticky `SaveBar` ("N changed" · Discard · Save); a failed row stays outlined red with
  one Alert on top. No "kept here outside the filter" notices — staged rows don't move until Save.

- **Sort** (orders, 2026-11-21): sortable column headers via the Table's `sort` prop (`sortKey` per
  column; a `null` key falls back to the default order), plus the same choice as a `Select` at the top
  of the filter Drawer, since phone cards have no headers. Sort is not a filter: no chip, no count.
- **Orders list columns — set by the user 2026-11-21:** ① order number (+ gift/quick-sale badges)
  with the piece names as a muted subtitle (`name (variant) ×qty · … · +N`, `line-clamp-2`)
  ② photos — up to 3 lines, **highest unit price first**, the last dimmed with `+N`
  ③ status ④ payment ⑤ date (date, time muted under it) ⑥ total ⑦ ⋯ menu. No customer/channel
  column. Phones: photos on top of the title cell (`md:hidden`; the photos column `hideOnMobile`),
  ⋯ beside the title (`besideTitleOnMobile`). The API sends `previewItems` (first 3 lines by price).
- **The row ⋯ is on EVERY row, always at the TOP-END corner** (user, 2026-11-21): "open" is always
  in it, role-gated actions are added when they apply (orders: "money received"). Desktop: the
  actions column gets `className: "align-top"`; phone cards: `besideTitleOnMobile` (the Table's
  card title row is `items-start`, so it stays in the corner beside tall photo titles).
- `useConfirm` defaults to delete styling (trash icon, red): pass `tone: "primary"` for anything
  that isn't a removal. Every confirm keeps its 3-second hold.
- A wide cell needs `className: "min-w-[13rem] [--cell-max:22rem]"` (sized to fit) on its column: Table caps cell
  content at `--cell-max` (18rem), which squeezes anything with photos + text.
- **Every product image is 1:1** — list thumbnails, gallery tiles and the product page's photo
  alike (`aspect-square` / `size-*`). Tiles and the big photo use `fit="contain"` so nothing of
  the garment is cut; small row thumbnails stay `cover`. Only a numbered-shawl photo keeps its own
  shape, because its point markers are placed by percentage.
- **Links never underline.** Hover changes the colour to the dark brand shade: `transition-colors
  hover:text-primary-700` (or `group` on the link + `group-hover:text-primary-700` on the name span
  when the text inside carries `text-ink`); a link already `primary-700` goes to `primary-900`.
- Buttons are the standard 36px: no `size="sm"`, no `h-12/h-14` overrides (POS touch targets excepted).
- `cn` comes from `@/lib/utils` (re-exports `@store/ui`'s, which knows `text-micro` etc. are sizes).
- Field labels and field text are weight **400**: `text-label text-ink`, never `font-medium` on a
  `<label>`/`<legend>` (section headings may stay medium).
- Money is always `MoneyField` (admin): numeric input + the Settings currency symbol inside the border.
- Every input looks like a field: built on `fieldShell` / `FIELD_TEXT` from `@store/ui`, adornments
  (−/+ , icons, units) inside the one border, split by `FieldDivider` — never loose boxes beside it.
- Tokens only (`bg-surface`, `text-ink-muted`, `border-line`, `primary-600` …) — never raw colours.
- Keys vs text: `PageHeader`, `EmptyState`, `Modal`, `ConfirmDialog` title, `FormField`,
  `Table` column `header`, `Tabs` labels take **keys**; everything else takes translated text.
- Name things for tests: `data-testid` on `@store/ui` components (written to `data-test-selector`
  too), literal `data-test-selector` on plain elements; purpose-first, no positions.
- **Comments: one line or none — in EVERY file the page touches, old comments included** (the page,
  its components, and the types/constants/api/hooks files you edit): collapse each multi-line block
  to one line that says a business rule or a non-obvious why, or delete it. Run a grep for `//` over
  those files before verifying; it is part of every run, not a follow-up.
- Anything added to `@store/ui` (a component, a new `size`) is also demoed on `/design-system`.
- Wording (ar): variants are **متغيرات**, never تركيبات.

## Learned so far
- Product page: status lived in a bespoke pill → `Badge`; price/barcode/stock were loose blocks →
  one facts grid; description/variants/photos were stacked → tabs; delete card → menu + confirm.
- Variants are a `Table` with `data-testid="variant"`, so rows stay `variant-row-<id>`.
- `Icon` names are a fixed set (see `ui/src/components/icon.tsx`); pick from it, e.g. `file`, `image`, `package`.

- Product form: the bar appearing at load exposed `galleryChanged` comparing `id:1:` to `id:1`; a
  "visible when dirty" save bar is a good check that change detection is actually correct.
- `react-hooks/incompatible-library` warning on react-hook-form `watch()` is expected; leave it.

- Folds open by animating `grid-template-rows` 0fr→1fr with the content kept mounted and `inert`
  when shut — smooth, no Radix Collapsible needed, and form inputs stay registered.

- Write message keys BEFORE the component that uses them: hot reload renders first and logs
  MISSING_MESSAGE errors that look like real bugs; reload before judging the console.
- In browser checks, await a re-render between clicks (setTimeout) — two synchronous `.click()`s
  read the same stale state and the second overwrites the first.
- The user reviews by screenshot and short notes ("bad", "needs enhancement"): propose the fix,
  apply, verify in the browser, and only ask (AskUserQuestion with previews) when the layout is a
  real choice.

- Inventory: low-stock filter returning 0 is the rule (only `trackLowStock` pieces count), not a bug.
- Never press Save in a check, and never touch a control that writes on its own: the sandbox
  database is shared with the user. Before and after a check, read the audit log for the last
  minutes (`auditLog.findMany({ createdAt: { gte } })`) so any write is noticed and reported.

- `Table` card titles are a `<div>` (not `<p>`): a cell with a photo inside a `<p>` is a hydration error on phones.

- Phone shell (admin): header = ☰ + shop logo + sandbox chip | language + account. ☰ opens
  `MenuSheet` — `Drawer side="start" size="sm"` (from the RIGHT in Arabic), logo in its title, pages
  grouped by `NAV_GROUPS` under small headings, deepest matching href active, no language/sign-out
  (the header has both). The bottom bar keeps 4 tabs, no "More".
- `Drawer`: `side="end"` (default) for content panels, `side="start"` for navigation.
- The ADMIN zooms (pinch / Ctrl+wheel) — only the POS till locks zoom (spec.md "An installed app").

- Orders: the hand-rolled tanstack table + separate phone `OrderCard` + own pagination → one
  `@store/ui` Table; page size is a field of the list filters (`pageSize`), sent to the API from there.
- `@store/ui` `Select` is a Radix combobox (a `<button>`), not a native `<select>`: drive it by
  clicking in browser checks, never by setting `.value`.
- At 1280px with the sidebar the table has ~950px: measure `orders-head-*` widths and the
  `-scroll` element's scrollWidth vs clientWidth before calling a wide table done.
- Test the long case by patching `window.fetch` in the page (fake rows, long names, many lines):
  the sandbox has few records, and patching the response writes nothing.
- The comment rule covers backend and shared files the page needed too (route, serializer, types).
- Order detail: line photos come from the detail API (`thumbnailUrl`, variant photo else product's).
  A minus before money needs `dir="ltr"` on its span, or Arabic puts it after the number ("45.00–").
- An API response already in the query cache is never re-fetched, so fetch patching misses it: open
  a made-up id (`/orders/fakeorder1`) and let the patch answer it from the real record plus changes.
- Deleting a component before rewriting its importer leaves a Module-not-found in the console log:
  check the error's timestamp before treating it as current.
- Date range filters use `DateRangePicker` in a `FormField`; the chip reads the days as local midnight.
- **Colours come from the designer's palette (user, 2026-11-21)**, set ONLY in `ui/src/themes/organza.css` +
  `organza.ts` (same values): dark-teal rail `#103F46`, active item `#197783`, canvas `#F1F7FA`, white cards,
  table heads/info areas `#F4F8FA`, ink `#102A3A`, borders `#DCE8EF`, green done `#16834A`/`#D8F5E5`, light-teal
  highlight `#E0F5F2`, soft teal-tinted shadows, 12px buttons. Never a raw hex in a page.
- The sidebar is dark: its items use the `rail-*` tokens (`NavLink onRail`); the phone menu stays light.
- **Breadcrumb lives in the shell** (`AppBreadcrumb`, built from the path by `lib/breadcrumb.ts`): shown on any
  page below a top-level one, with a ← to the parent. Pages carry NO back link of their own; a new kind of
  sub-page adds its leaf wording to `BREADCRUMB_SECTIONS` + `breadcrumb.*` messages.
- **Header search** (`GlobalSearch`, "/" or ⌘K): orders, products, customers (from orders) and pages through the
  list endpoints, each gated by `can()`; "see all" opens `/orders?q=` / `/products?q=`, so a list page reads `q`
  from the URL. The sidebar logo sits straight on the dark rail (no white box), the sandbox chip beside it.
- The sidebar collapses to an 84px icon rail from a round toggle on its inner edge (`sidebar-toggle`); the
  choice is per browser (`useSidebarCollapsed`), labels become `sr-only` + `title`, badges sit on the icon.
- Search results and other tight rows: a badge never shares a line with text that can truncate; give it its own
  line (`ms-auto`) so the badge stays whole and only the name shortens.
- The nav lights the deepest matching href (`activeHref` in `lib/nav.ts`), so a record page keeps its list lit.
- **Record-page sections are `DetailCard`s** (`components/layout/detail-card.tsx`): icon + semibold title, `p-5`,
  `gap-4`. The header card leads with an icon tile (`size-14 bg-primary-50`), and its facts are a tinted
  strip (`bg-sunken`, bordered cells with an icon each, the money cell `bg-primary-50`), 2 per row on phones.
  Totals sit inside the pieces card, the final total on a `bg-primary-50` row.
- **Section and fact icons are `text-primary-700` (user, 2026-11-21)** — not `text-ink` (read as black) and not
  `primary-900` (too dark). It measures 7:1 on white, the sunken strip and `bg-primary-50`.
- **Keyboard focus is a darker colour, never an outline or ring (user, 2026-11-21).** `base.css` turns outlines
  off everywhere, so every focusable thing needs one of: `Button`/`buttonClassName` (already darker than hover),
  `focus-link` for a text link (darker ink, tint, thick underline), `focus-darken` for cards, tiles, chips, photos
  and icon buttons, or explicit `focus-visible:` tokens a shade or two darker than its hover. On the dark rail
  darker is invisible: use `focus-visible:bg-rail-active text-rail-ink-active`. Radix highlights
  (`data-highlighted:`) are `bg-primary-100 text-primary-900` (danger: `bg-danger-100 text-danger-800`). A ring
  that marks *selection* (chosen variant, primary photo) is not focus and stays.
- **Phone / WhatsApp / email are `@store/ui` `PhoneLink` / `WhatsAppLink` / `EmailLink` with `value` (user,
  2026-11-21)** — never a hand-built `<a href="tel:">`. WhatsApp opens `wa.me` (a `tel:` link dials instead);
  `WhatsAppLink` shows the number when given no `label`. Copy-able text keeps `{...SELECTABLE}` on its wrapper.
- **Repeated row markup becomes one component (user, 2026-11-21)**: two rows with the same classes is the sign
  (e.g. `CustomerContactRow` for the customer card: icon beside the link, `multiline` for an address). Its props
  type goes in `types/`, not in the component file.
- A step indicator (order progress) marks the current step `aria-current="step"`, shows a tick on finished steps
  and an `sr-only` "done" / "current step", so state never rests on colour alone (WCAG 1.4.1).
- Before calling a page done, check contrast of every token pair it uses: text 4.5:1, icons and control edges
  3:1. Watch the badge tones — warning (4.60) and info (4.62) sit just over the line on their tinted fills.

## Done
- admin `products/[id]` (record) — 2026-11-21
- admin `products/[id]/edit` + `products/new` (form, shared `product-form.tsx`) — 2026-11-21
- admin `inventory` (list — first list pattern) — 2026-11-21
- admin `orders` (list) — 2026-11-21
- admin `orders/[id]` (record, two columns) — 2026-11-21
