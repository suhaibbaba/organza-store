# Organza Rebuild Proposal

Nov 16, 2026 · @Suhaib

## Summary

Rebuild as one application on a new foundation: ledgers for stock and money, real customers and suppliers, and one sales document that covers counter sales, debts, held goods and online orders. Do not patch the current code. Its catalogue, search, images and scanner work are worth porting; its stock and money model is not.

**Why not patch.** The audit found that the problems are in the foundations, not the screens:

- Stock is an overwritable number with no history. A manual edit or an approved request can bring sold stock back.
- There is no payment, refund, customer or supplier record. Partial payment, debt, exchange and purchasing have nowhere to live.
- Money corrections edit rows in place. Reports, the cash drawer and the courier balance can disagree, and a refund never reaches the till.
- Duplicate sales are possible (no idempotency), and several stock and money actions check-then-act outside their transaction.
- Admin and POS are two forked apps: about 4,900 lines duplicated, two sign-ins, order creation built twice.

**What I recommend.**

| Decision | Recommendation |
| --- | --- |
| Frontend | One Vite + React single-page app: admin, POS workspace and orders. Desktop and phone layouts designed separately from the same components. |
| Backend | NestJS on Fastify with the clinic system's patterns (capability guard, audit, unit of work, ledgers). PostgreSQL. |
| Windows | Tauri 2 shell around the same app build: small install, signed auto-updates, silent receipt printing. |
| iPhone (iOS 15) | Installable web app (PWA). Mantine instead of Tailwind v4 removes about 860 lines of CSS repair tooling. Push notifications cannot work on iOS 15; an in-app activity feed replaces them on that device. |
| Stock | Append-only movement ledger, plus a locked balance row per sellable item for speed and safe concurrency. |
| Money | A small automatic double-entry ledger. Staff never see debits and credits; every sale, payment, refund, expense, purchase and supplier payment posts itself. |
| Sales | One document with payments allocated to it: Paid, Partially paid or Unpaid; goods Taken or Held. Debt is the unpaid balance, store credit is a separate balance. |
| Offline | Not in the first release. Make checkout retry-safe first; revisit a cash-only offline queue for the Windows till later. |

**Order of work.** Foundations, then catalogue and stock, then sales, payments, debts and the POS, then returns and exchanges, then online orders, then purchasing, then reports, then the Windows app, then cut-over. The existing system stays live until a rehearsed one-night switch.

## A. Current system audit

The current system works for its original scope, but its stock and money foundations cannot carry debts, partial payments, exchanges or purchasing. Findings come from reading the code, not the spec; file references are in the audit notes and can be attached on request.

### Architecture today

| Part | Technology | Size (TypeScript lines) |
| --- | --- | --- |
| backend | Express 4, Prisma 6, PostgreSQL 16, Better Auth, Zod 3 | 14,700 + 1,300 schema |
| admin | Next.js 16, React 19, Tailwind 4, TanStack Query, next-intl | 28,500 (22 pages) |
| pos | Same stack as admin | 11,600 (one selling screen) |
| shared | Zod schemas, constants, iOS 15 build tooling | 5,600 + 860 tooling |
| Deploy | Docker Compose on one VPS; GitHub Actions SSH, build on the server | No tests, lint or type check in CI |

A large share of the lines are long prose comments (at least 8,000 in the two apps).

### Modules and what works

- **Catalogue:** products, variants (cartesian sizes and colours), numbered shawls as variants with photo points, global option values, per-product option notes, categories, slug, SKU, EAN-13 generation, supplier barcodes, label printing.
- **Search:** Arabic-normalized, multi-language, typo-tolerant (pg\_trgm). Worth keeping.
- **Images:** original kept, crop rectangle stored, three WebP sizes with sharp. Worth keeping.
- **Orders:** store, WhatsApp and website channels; status flow; line and order discounts; price and cost snapshots; partial returns; gifts; quick sell.
- **Money:** delivery-company collection flag, one cash drawer per day with a blind count, expenses with categories and approval, sales and profit reports.
- **Control:** three roles, 47 permission actions (15 protected), editable role grants, a generic change-approval queue, audit log, Web Push to admins.
- **POS:** hardware scanner support that works under an Arabic keyboard layout, camera scanner, keyboard shortcuts, product browser, variant picker.

### Problems and technical debt (ranked by business risk)

| # | Problem | Consequence |
| --- | --- | --- |
| 1 | Stock is a number that is overwritten; there is no movement history | No reason for any change, no stock at a past date, no valuation, no stock count. A manual edit or a late-approved request silently restores sold stock. |
| 2 | No payment, refund or cash-movement record | Refunds never leave the till on paper, so the drawer looks short. Deleting or cancelling a collected order makes its money vanish. |
| 3 | No idempotency on checkout; audit written after commit | A retried request creates a second sale and deducts stock twice. An audit failure reports a saved sale as failed, inviting that retry. |
| 4 | Check-then-act outside transactions | Two clicks on Preparing deduct stock twice; two concurrent returns restore stock twice; two closes overwrite each other. No database CHECK constraints anywhere. |
| 5 | Corrections edit in place | Completed orders' discounts, approved expenses and closed periods change history; only the audit JSON remembers the old value. |
| 6 | Blind count is blind only in the screen | The expected cash is returned by the API and in the error of a wrong count, and failed attempts are not logged. |
| 7 | Reports count unconfirmed online orders as revenue; reports use order date while the drawer uses collection date | The two never reconcile. |
| 8 | Returns always go back on the shelf | A damaged return inflates stock and hides the loss. |
| 9 | Product creation is not atomic (several writes, no transaction); a 1,001-line form | Half-built products after a failure; employees can create unwanted variants that stay sellable until an admin approves their removal. |
| 10 | Barcode and SKU uniqueness across products and variants is an app check only | A collision silently scans the wrong item. Hidden variants can still be sold. |
| 11 | Two forked apps | \~4,900 duplicated lines, two sign-ins, two service workers, order entry built twice. |
| 12 | iOS 15 support is done by post-processing Tailwind 4 and Next output | 860 lines of fragile tooling that every upgrade can break. |
| 13 | Tests need the live sandbox API and change its data; POS has none | Nothing guards a deploy. |
| 14 | Session token in localStorage with a readable cookie copy | Weak against script injection; needs rework for a desktop app anyway. |

### Missing functionality

- Customers as records, customer debt, store credit, partial and split payments, payment methods other than cash.
- Exchanges, refunds as money events, damaged returns.
- Suppliers, purchases, receiving, supplier payments and debt, cost history.
- Stock counts, damage and loss, reservations for held goods and online orders.
- An order preparation (picking) view; order photos in the order screen.
- Receipt printing, a cash-drawer shift per cashier, cash paid in and out during the day.
- A ledger that ties revenue, cash, receivables, payables and profit together.

## B. Recommended architecture

One single-page app served as static files, one API, one PostgreSQL database, and a thin Windows shell around the same app. The clinic system is not smaller (about 150,000 source lines against Organza's 60,000), but it has fewer moving parts and much stronger integrity patterns. Those patterns are what should carry over.

### Organza vs the clinic system (evidence)

| Area | Organza today | Clinic system | Better fit for the rebuild |
| --- | --- | --- | --- |
| Frontend | Two Next.js apps, each a Node server | One Vite + React SPA served by nginx | SPA: no server rendering is needed behind a login, and the same build runs inside Tauri |
| API | Express, routes 800-1,000 lines each | NestJS on Fastify, fixed module layout, lint-enforced boundaries | NestJS: structure and guards come with the framework |
| Database access | Prisma | Drizzle with plain SQL migrations | Drizzle: row locks (`FOR UPDATE`), CHECK constraints and triggers are first-class |
| Stock | Overwritable column | Append-only movements, row locks, idempotency key | Clinic pattern, plus a locked balance row |
| Money | Flags on orders | Append-only charges and payments, reversal rows, DB triggers forbid rewrites | Clinic pattern, extended with allocation and a ledger |
| Purchasing | None | Receipts, supplier invoices, credit notes, oldest-first payment allocation, period lock | Port almost directly |
| Permissions | Hand-listed actions + editable table | Capabilities discovered from the routes, one guard | Clinic pattern with fixed roles |
| Auth | Better Auth, token in localStorage | Own JWT + rotating refresh token in an httpOnly cookie | Clinic pattern; desktop keeps the refresh token in Windows secure storage |
| Tests | HTTP tests against the live sandbox | \~1,100 API tests against a disposable test database | Clinic pattern, plus concurrency tests |
| iOS 15 | 860 lines of CSS repair | Nothing specific | A build target that supports iOS 15 natively (below) |

What not to copy from the clinic: audit rows written after commit (write them in the same transaction instead), multi-clinic tenancy (not needed), and balances recomputed from scratch on every read (retail volumes need a cached balance).

### Options considered

| Option | For | Against | Verdict |
| --- | --- | --- | --- |
| Next.js full stack (API routes) | One project, already known | Server needed for the UI; Tauri needs a static export, which drops server features; long transactions and background jobs fit poorly | No |
| Keep Express + Prisma, rewrite the logic | Least new tooling | Every fragile pattern found in the audit lives here; Prisma is awkward for locks and constraints | No |
| Vite SPA + NestJS + Drizzle (clinic-style) | Proven by you on the clinic; static UI serves web, phone and Windows alike; strong integrity tools | New schema and migration needed anyway | **Recommended** |
| React Native / native mobile app | Native feel | A second UI codebase; not needed for a shop counter | No |

### Stack

- **Web app:** Vite, React 19, React Router, TanStack Query, react-hook-form + Zod, Mantine components, i18next (Arabic default, English, Hebrew), URL-held filters and tabs.
- **Styling:** Mantine with CSS modules, no Tailwind. Every Mantine component works right-to-left, and it supports Safari 15.4 and newer, so the iPhone 7 Plus must be on iOS 15.4 or later (it can update to 15.8). Tailwind 4 targets Safari 16.4 and newer, which is the gap the current 860-line repair layer patches; without Tailwind 4 the repair layer disappears.
- **API:** NestJS 11 on Fastify, Drizzle ORM, PostgreSQL 17, Zod schemas shared with the web app.
- **Auth:** email + password (argon2), short access token, rotating refresh token. Web: httpOnly cookie. Windows: refresh token in Windows Credential Manager.
- **Files:** images stay on the VPS disk with sharp, as today.
- **Deploy:** Docker Compose on the existing VPS: nginx (static app + proxy), API, Postgres. CI runs type check, lint and the API tests against a throwaway database before any deploy; images are built in CI, not on the server. Nightly backups of the database and uploads are copied off the VPS, and a restore is tested before cut-over.

### Windows desktop

**Tauri 2**, wrapping the same built app. Installer of a few MB, uses the WebView2 runtime already on Windows 10/11, low memory, signed auto-updates from the VPS.

- **Barcode scanners:** USB scanners act as keyboards, so the existing scanner hook works unchanged.
- **Receipt printers:** a small native command sends ESC/POS bytes to the 80 mm printer and opens the cash drawer through it, with no print dialog. Browsers and phones fall back to a printable receipt page.
- **Alternative:** Electron. Same Chromium everywhere, but an installer of \~100 MB and several hundred MB of memory. Only worth it if WebView2 turns out to be missing on the shop's PCs.
- **Linux later:** the till runs Windows today and may move to Linux. The same app then runs as a Tauri Linux build (WebKitGTK engine instead of WebView2, so it needs its own test pass) or in a Chromium kiosk. The printing command and token storage are written against cross-platform interfaces so neither is redone.
- **Touchpad gestures:** WebView2's elastic overscroll lets a touchpad swipe drag the whole window. The app shell sets `overflow: hidden` and `overscroll-behavior: none` on the root so only inner panels scroll, and the Tauri config disables `ElasticOverscroll` and swipe navigation.

### iPhone and iOS 15

The app is installed to the home screen (PWA). Build target set to Safari 15 so newer JavaScript syntax is compiled down; a small polyfill set covers the rest.

| Limitation on iOS 15 | Effect | Fallback |
| --- | --- | --- |
| No Web Push (arrives in iOS 16.4) | That phone cannot receive sale notifications | In-app activity feed with a badge, refreshed while the app is open; push still works on newer phones and Windows |
| No `BarcodeDetector` | Camera scanning needs a JavaScript decoder | Keep the current decoder (html5-qrcode / ZXing), loaded only when the camera opens |
| 15.0-15.3 lack `:has()`, `@layer`, `dvh`, `Array.at`, `structuredClone`; all of 15 lacks `color-mix()` and container queries | Silent CSS or script failures | Phone kept on 15.4 or later, Mantine, no container queries or color-mix() in our own styles; one automated check that the build parses on Safari 15 |
| Older device, slower JS | Long lists lag | Paginated lists, virtualized long tables, images in WebP at the right size |
| Number formatting differs by device | Arabic-Indic vs western digits | Keep today's rule: every number formatted with stated digits |

Which iOS 15 minor version the phone runs (15.0-15.3 or 15.4+) changes how much of this applies. That is an open question in H.

### Offline POS

**Not in the first release.** The value is real but small for a shop on a stable connection, and the risk is concentrated in the shop's most valuable stock.

- **Risks:** a numbered shawl is a single piece, so two tills selling offline can sell it twice; prices and debts may be stale; reconciling after reconnecting needs conflict screens; card payments cannot be confirmed offline.
- **First release instead:** every checkout carries an idempotency key, so a retry after a dropped connection can never create a second sale. The cart is kept on the device, so a crash or reload loses nothing. A clear "not saved yet" state shows until the server confirms.
- **Later, if outages prove frequent:** a cash-only offline queue on the Windows till, limited to items that are not single pieces, synced with the same idempotency keys, with any oversell landing in an exceptions list for a manager.

## C. Business logic by module

Every module below follows three rules. Every change to stock or money is a dated row that is never edited. A correction is a new row that reverses the old one. Every write happens in one transaction with its audit entry.

### 1. Products and catalogue

| Area | Description |
| --- | --- |
| Current logic | One Product row plays three roles (simple, parent of variants, numbered collection) plus quick-sell states. Variants are generated as a full cartesian product, then unwanted ones deleted. |
| Problems | 1,001-line form; non-atomic create; variant numbers and SKUs reused after a hard delete; hidden variants sellable; barcode uniqueness only checked in code. |
| Proposed logic | **Product** (what the customer sees: name, photos, category, type) and **Item** (what is counted and sold: price, cost, stock, barcodes). A regular product has exactly one item; a variant product one item per chosen combination; a numbered product one item per number. Every sale, stock movement and barcode points to an item, so the rest of the system never needs to know the product type. |
| Business rules | Type chosen at creation and fixed. Create is one request in one transaction. Only the combinations ticked are created. Items are archived, never deleted. A barcode table holds every code (ours and the supplier's) with one unique index across the shop. SKU frozen at creation. Item price empty = product price. Employees see no cost. |
| Edge cases | Supplier code shared by every variant (opens the variant picker); same supplier code on two products (refused at entry, showing the other product); a product edited after being sold (old sale keeps its snapshot); archiving a product with stock (asks to write off or keep). |
| Dependencies | Inventory, sales, purchasing, labels, search. |
| Priority | Critical |

### 2. Inventory

| Area | Description |
| --- | --- |
| Current logic | `stock` integer set directly by forms, approvals and sales. |
| Problems | No history, lost updates, sold stock restored by late approvals, no damage, counts or receiving. |
| Proposed logic | Append-only **stock movement** per item with a reason (sale, return to shelf, return damaged, purchase received, supplier return, gift, damage, count adjustment, migration opening). A **balance row** per item holds on-hand, reserved and damaged, updated in the same transaction and locked while it changes. Available = on-hand minus reserved. |
| Business rules | Database CHECKs: on-hand ≥ 0, reserved ≥ 0, reserved ≤ on-hand. Adjustments are entered as a counted quantity or a delta, never a silent overwrite. Each movement carries who, when, why and the source document. A nightly job compares balances to the movement sum and alerts on any difference. |
| Edge cases | Last piece sold on two tills (one wins, the other is told at once); count finds fewer pieces than recorded (count document posts a loss with reason); a damaged return (goes to the damaged bucket, out of available stock). |
| Dependencies | Sales, orders, returns, purchasing, gifts, accounting (inventory value). |
| Priority | Critical |

### 3. Customers

| Area | Description |
| --- | --- |
| Current logic | No customer record; name and phone copied onto online orders; a phone search scans recent orders. |
| Problems | No history, no debt, no credit, duplicates by phone format. |
| Proposed logic | **Customer** with name, phone(s), WhatsApp, address, notes. Debt balance and credit balance are derived from the ledger. Statement = a chronological list of sales, payments, returns, credits and corrections with a running balance. |
| Business rules | Phone normalised to E.164 on entry, unique; the +970/+972 check stays. Counter sales may stay anonymous unless they are unpaid or held, which require a customer. Merging two customers is an admin action that moves history, audited. |
| Edge cases | Customer with debt and credit at the same time (offered to offset, never automatic); a phone number reused by a new person (edit, audited). |
| Dependencies | Sales, payments, returns, orders, accounting, reports. |
| Priority | Critical |

### 4. Sales and payments

| Area | Description |
| --- | --- |
| Current logic | An order with a cash-only flag; collected or pending as a whole. |
| Problems | No partial or split payment, no methods, no refunds, no payment history. |
| Proposed logic | One **Sale** document for every channel with lines (price and cost snapshots, discounts). **Payments** (cash, card, bank transfer, store credit, courier) are separate rows, each with amount, method, date, reference, taken by. A payment is **allocated** to one or more sales. Payment state is derived: Paid, Partially paid, Unpaid. |
| Business rules | Checkout carries an idempotency key: the same key returns the same sale. A sale is final once completed; changes are returns, exchanges or a manager void (a reversal, not a delete). Discounts above a set limit need a manager. Overpayment becomes customer credit, never silently kept. Multiple currencies with one default: prices, debts and the ledger are in the default currency; a payment in another currency records the currency, the amount received and the exchange rate used, and posts at its default-currency value. Change is given in the default currency unless the cashier picks otherwise. |
| Edge cases | Split payment (cash + card); card terminal approved but app crashed (same key, sale found, not duplicated); price changed while the cart was open (server price wins, cashier sees the change). |
| Dependencies | Inventory, customers, cash drawer, accounting, receipts, notifications. |
| Priority | Critical |

### 5. Debts and held goods

| Area | Description |
| --- | --- |
| Current logic | Not supported. |
| Problems | The shop keeps debts outside the system. |
| Proposed logic | Each sale has a fulfilment mode. **Taken**: stock leaves now, any unpaid amount is customer debt. **Held in store**: stock is reserved (not sellable, still on the shelf), and released to the customer by a **hand-over** action. A debt repayment is a payment allocated to the oldest unpaid sales first, or to sales the cashier picks. |
| Business rules | Any employee may sell on debt, no limit (your decision), customer required, every step audited. Hand-over is allowed at any time; if money is still owed the screen says so and asks for confirmation, so the shop decides case by case. A held sale never paid is resolved by staff choosing, per case: cancel and refund, cancel and keep as credit, cancel and keep the deposit (Admin/Manager only), or keep waiting. |
| Edge cases | Customer pays part of three debts in one go; held goods partly handed over; customer asks to swap a held piece (exchange on a held sale). |
| Dependencies | Sales, inventory reservations, customers, accounting, reports (aging list). |
| Priority | Critical |

### 6. Returns and exchanges

| Area | Description |
| --- | --- |
| Current logic | Partial returns that always restock; no refund record; no exchange. |
| Problems | Damaged returns inflate stock; refunds invisible to the drawer; concurrent returns can double-restore. |
| Proposed logic | A **Return** document against original sale lines, each line marked *back to shelf* or *damaged*. An **Exchange** is one document holding the return lines and the new lines; the difference is settled in the same screen: pay, add to debt, refund, or store credit. |
| Business rules | Returned quantity can never exceed sold minus already returned (row lock + CHECK). The refund cannot exceed what was paid for those lines; the unpaid part reduces debt instead. Refund method defaults to the original method. Employees may do exchanges and returns to credit; cash or card refunds above a set amount need a manager (decision in H). |
| Edge cases | Return of a discounted line (refund the discounted price); item bought on debt and returned (debt reduced, no cash out); return after the shift closed (lands in today's drawer). |
| Dependencies | Sales, inventory, customers, cash drawer, accounting. |
| Priority | Critical |

### 7. Orders and fulfilment (online, WhatsApp, in store)

| Area | Description |
| --- | --- |
| Current logic | Same Order table; status NEW, PREPARING, HANDED\_TO\_COURIER; stock deducted at PREPARING; courier money a yes/no flag. |
| Problems | No pick list or photos; double deduction on double click; unconfirmed orders counted as revenue; courier money assumed to land in the till; orders editable after collection. |
| Proposed logic | An order is a Sale with **source** (store, WhatsApp, online) kept separate from **fulfilment status**: New → Confirmed (stock reserved) → Preparing → Ready → Handed to courier / Collected by customer, plus Cancelled and Returned to shop. Stock is reserved at confirmation and leaves at hand-over. The courier is a **delivery company account**: cash on delivery becomes money the company owes; a settlement is a payment from that company allocated to orders, minus its fee (an expense). |
| Business rules | Status changes are conditional updates ("from Preparing to Ready"), so a double click does nothing. An item that cannot be reserved shows as unavailable on the pick list. Lines can be changed until Ready; after that only by cancel or return. A repeat order for the same customer, items and day is flagged as a possible duplicate before saving. Revenue is recognised at hand-over, not at entry. |
| Edge cases | Partial fulfilment (ship what is available, the rest stays reserved or is cancelled line by line); parcel refused (Returned to shop: stock back, courier balance reversed); courier pays less than expected (difference stays open on that company's account). |
| Dependencies | Sales, inventory reservations, customers, accounting, notifications. |
| Priority | Important |

### 8. Suppliers and purchasing

| Area | Description |
| --- | --- |
| Current logic | Not supported; cost is one field overwritten by hand. |
| Problems | No purchase cost history, no supplier debt, no receiving. |
| Proposed logic | **Supplier** with contact, statement and balance. **Purchase** (what was ordered, optional) → **Receipt** (what arrived, adds stock at cost) → **Supplier bill** (what is owed, may add shipping or customs spread over the lines). **Supplier payments** are allocated oldest bill first. Supplier returns and refunds are their own documents. Ported from the clinic's purchasing module. |
| Business rules | Receiving fewer than ordered leaves the rest open. A posted bill is corrected by a credit note, not edited. Costing: weighted average per item; a numbered piece is its own item, so its cost is exact. Purchases add to inventory value, not to expenses; cost of goods is recorded only when an item is sold. |
| Edge cases | Partial deliveries; goods received before the bill; one payment covering three bills; supplier refund in cash. |
| Dependencies | Inventory, products (new items while receiving), accounting, cash drawer. |
| Priority | Important |

### 9. Accounting

| Area | Description |
| --- | --- |
| Current logic | Report queries over order lines and expenses; no ledger. |
| Problems | Revenue, cash and owed money computed different ways on different dates; history changes after the fact. |
| Proposed logic | A **small automatic double-entry ledger**: 19 fixed accounts (listed in E), journal entries posted by the system from each document. Staff never type a journal entry; an admin can post a manual adjustment with a reason. Reports read the ledger. |
| Business rules | Every entry balances (debits = credits), checked by the database. Entries are append-only; corrections reverse. A debt repayment moves money from receivable to cash and is never revenue. A purchase moves cash or payable into inventory; only a sale moves inventory into cost of goods. Optional month close blocks back-dated entries. |
| Edge cases | Sale with unknown cost (posted at zero, listed until the cost is filled, then a correcting entry); refund of a sale from last month (posted today, last month stays as reported). |
| Dependencies | Every module that moves money or stock. |
| Priority | Critical |

### 10. Cash drawer and daily closing

| Area | Description |
| --- | --- |
| Current logic | One session per calendar day; expected = float + cash sales − cash expenses; one withdrawal at close; blind only in the screen. |
| Problems | No refunds, paid-in or paid-out; courier settlements counted as till cash; expected figure leaks through the API; no cashier accountability. |
| Proposed logic | A **register** (a till) and a **shift** per cashier on it. Expected cash = opening float + cash payments in − cash refunds − cash expenses − cash supplier payments ± paid-in/paid-out − drops to the safe or bank, each listed line by line. |
| Business rules | Blind count enforced on the server: the expected figure is not returned until a count is submitted, and the count is final. A recount needs a manager and both counts are kept. A difference never blocks the close; it requires a note and is listed until signed off. One open shift per register. Cash is counted and reconciled per currency. |
| Edge cases | Shift left open overnight (next shift may open; old one flagged); cash refund after close (belongs to the shift that paid it out); two tills (each counted separately, one day summary). |
| Dependencies | Payments, refunds, expenses, accounting. |
| Priority | Critical |

### 11. Gifts

| Area | Description |
| --- | --- |
| Current logic | An order of type GIFT priced at zero; cost subtracted from profit; returnable and deletable. |
| Problems | Deleting a gift erases its cost; "gift" mixes three different things. |
| Proposed logic | Three separate cases under one Gift button: **Giveaway** (complimentary item: stock out at cost, booked as a promotion expense); **Gift purchase** (a normal sale marked as a gift, with a gift receipt that hides prices); **Gift voucher** (store credit sold or given, a liability until used; optional, see H). A gift discount is just a discount. |
| Business rules | Giveaways by Admin/Manager only. A gift purchase can be exchanged by the recipient using the gift receipt; refunds go to credit. A returned giveaway reverses its movement and expense. |
| Edge cases | Giveaway added to a paid sale (one document, the gift line at zero, cost booked separately). |
| Dependencies | Sales, inventory, accounting, reports. |
| Priority | Important |

### 12. Permissions, approvals and security

| Area | Description |
| --- | --- |
| Current logic | 47 actions, an editable table for 32 of them, a generic change request for price, stock, image delete, visibility, variant set, expenses, quick-sell completion. |
| Problems | Complex to reason about; approved values are absolute and can be stale; requests filed after commit can be lost. |
| Proposed logic | Capabilities declared on the API routes (clinic pattern), fixed role defaults, no permission editor (decision in H). One **approval inbox** for a short list of employee actions. Approvals apply a **delta or a document** ("reduce stock by 2, reason damage"), never an old absolute value. |
| Business rules | Needs approval (employee): price change, stock adjustment, hiding a product, deleting an image, expense above a threshold, cash refund above a threshold, void of a completed sale, quick-sell completion review. Direct (no approval): selling, debt sales, held sales, payments, exchanges to equal or higher value, returns to credit. Admin only: cost, profit, reports, staff, settings, keeping a deposit, manual ledger entries. Managers cannot approve their own requests. |
| Edge cases | Request filed, then stock sold before approval (delta still valid; refused only if it would go negative). |
| Dependencies | Everything. |
| Priority | Important |

### 13. Notifications

| Area | Description |
| --- | --- |
| Current logic | Web Push to admins on each sale by someone else. |
| Problems | Fire-and-forget, lost on failure; impossible on iOS 15. |
| Proposed logic | An **activity feed** inside the app (sales, approvals waiting, held goods due, debts overdue), plus Web Push where the device supports it, sent from a small outbox table with retries. |
| Priority | Optional |

## Critical scenarios

Each scenario has one defined outcome under the proposed model; the right-hand columns say what moves. "Today" is how the current code behaves.

| # | Scenario | Today | Proposed behaviour | Stock | Money and balances | Reports |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Two employees sell the last item at once | Safe for counter sales; online orders can double-deduct | Item balance row locked; the second checkout is refused with "sold just now" and the cart line turns red | One sale out | Only the winning sale posts | One sale |
| 2 | Partial payment, goods taken | Not possible | Sale completed as Partially paid, customer required | Leaves now | Payment to cash; rest to customer receivable | Revenue in full today; debt list shows the balance |
| 3 | Goods reserved, never paid | Not possible | Held sale stays reserved; flagged after N days; staff choose cancel + refund, cancel + credit, keep deposit (Admin/Manager), or keep waiting | Reserved until cancelled, then released | Deposit refunded, moved to credit, or booked as other income | No revenue until hand-over (or as other income if kept) |
| 4 | One payment for several debts | Not possible | Payment allocated oldest first, editable before saving | None | Receivable down; cash up | Cash received; not revenue |
| 5 | Exchange, customer owes the difference | Return + new sale, unlinked | One exchange document; difference paid now or added to debt | Old item back (shelf or damaged), new item out | Net difference only | Revenue changes by the difference |
| 6 | Sale cancelled after partial payment | Collected money silently disappears | Manager void: reversal entries; paid part refunded or kept as credit, staff choose | Back to shelf | Payment reversed or moved to credit | Shown as a void on the day it happened |
| 7 | Returned item cannot be resold | Restocked anyway | Return line marked damaged | To damaged bucket, not available | Refund as usual; cost moved to damage loss | Damage loss visible |
| 8 | Supplier delivers fewer than ordered | Not possible | Receipt records what arrived; the rest stays open or is closed short | Only received quantity in | Bill for received quantity | Open purchase list |
| 9 | Supplier paid partially | Not possible | Supplier payment allocated to the oldest bill | None | Payable down by the payment | Supplier debt list |
| 10 | Courier collects on the shop's behalf | Flag; counted as till cash | Hand-over creates an amount owed by that company; settlement is a payment from it, fee booked as expense | Left at hand-over | Courier receivable, then bank or cash | Owed by courier, by company and age |
| 11 | Payment succeeds, app crashes | Retry creates a second sale | Same idempotency key returns the saved sale; the cart reopens showing "already saved" | Once | Once | Once |
| 12 | Internet drops during checkout | Same as 11 | Cart kept on the device; retry with the same key when back | Once | Once | Once |
| 13 | Same sale submitted twice | Two sales | Same key: one sale. Different key, same cart within a minute: warning before saving | Once | Once | Once |
| 14 | Product edited after being sold | Snapshot kept (good) | Unchanged: lines keep name, price and cost snapshots; the product page shows the edit history | None | None | Old sales unchanged |
| 15 | A financial transaction needs correcting | Edited in place | Reversal of the wrong entry plus a correct one, with reason and approver | As corrected | Both entries visible on the statement | Correction shown on its own date |
| 16 | Physical count differs from the system | Overwrite the number | Stock count document: count, review differences, post; each difference is a movement with reason | Adjusted by movements | Loss or gain at average cost | Shrinkage report |

## D. Workflows

Each daily task is one screen with a clear primary button; steps below are what the person does, not what the system does behind it.

&#91;embedded content: sale lifecycle · counter and online\]

Counter and online sales are the same document; only the path to hand-over differs, and money state never blocks a step.

### Product creation

1. Tap **New product** and choose the type: Regular, Variant or Numbered.
2. **Regular:** name, price, photo, category, stock (default 1). Barcode generated, or scan the supplier's.
3. **Variant:** same header, then pick option types (size, colour). A grid shows each combination with a tick, stock and an optional price; only ticked rows are created. Supplier barcode per row, or one shared code for all.
4. **Numbered:** upload the shawl photo, tap to place numbers 1, 2, 3...; each number gets stock 1 (editable) and its own barcode. Numbers can be placed before the first save.
5. **More options** (collapsed): cost (Admin only), compare-at price, description, low-stock alert, option notes.
6. **Save** creates everything at once. The next screen offers **Print labels**.

**Quick sell** (POS): type a name and price, sell. The incomplete product goes to a "needs completing" queue for a manager to add category, cost and photo or mark it one-off.

### POS checkout

1. Scan, search, or browse by photo; each hit adds to the cart (the variant or number picker opens when needed).
2. Adjust quantity or discount on a line; optional customer (required for debt or held).
3. Press **Pay** (F8 on desktop). The payment panel shows the total and a key per method; amounts can be split across cash, card, transfer and store credit.
4. Choose **Taken** (default) or **Held in store**. If paid less than the total, the remainder shows as "customer owes".
5. **Complete**: receipt prints (Windows) or shows to print/share (phone). Cart clears; the sale is in the shift.

### Debt sale and repayment

1. At checkout pick or create the customer, pay part or nothing, complete. The receipt shows the remaining balance.
2. Later: open the customer (or search their phone from the POS), press **Receive payment**, enter the amount and method.
3. The screen proposes the allocation, oldest sale first; staff can tick specific sales instead.
4. Save: receipt shows the new balance; any excess becomes credit.

### Returns and exchanges

1. Scan the receipt or find the sale (by customer, number or item).
2. Tick the lines and quantities coming back; mark each **back to shelf** or **damaged**.
3. Optional: add new items for an exchange.
4. The screen shows the difference and the choices that apply: pay, add to debt, refund (method), or store credit.
5. Complete; approval is asked in place only when a rule requires it (a large cash refund).

### Order preparation

1. **Orders board** with columns: New, Confirmed, Preparing, Ready, Out. Mobile shows one column at a time with counts on tabs.
2. Confirming reserves stock; lines that cannot be reserved show red.
3. **Pick list** for one or several orders: photo, name, size or number, quantity, shelf location; tick as picked.
4. **Ready** prints the packing slip; **Handed to courier** or **Collected** completes it.
5. Returned parcels: scan or open the order, **Returned to shop**, mark items shelf or damaged.

### Inventory receiving

1. Open a purchase (or start receiving without one) and pick the supplier.
2. Scan or search items; new items can be created inline with the three product types.
3. Enter quantity and unit cost; extra costs (shipping) can be added and spread.
4. **Receive**: stock rises; labels are offered for the new pieces; the supplier balance rises unless paid now.

### Supplier payments

1. Open the supplier, press **Pay**, enter amount, method and reference.
2. Allocation proposed oldest bill first; editable.
3. Save: supplier statement updates; cash payments come out of the current shift or the safe.

### Gifts

1. In the POS cart, **Gift** offers: Giveaway (Admin/Manager), Gift purchase, Gift voucher.
2. Giveaway lines are free; the receipt and the report show them as gifts at cost.
3. Gift purchase prints a gift receipt without prices.

### Daily cash closing

1. **Close shift**: enter the count by note and coin denomination (or a total).
2. Submit. Only now the screen shows expected, counted and the difference, with each line of the expectation.
3. If different: a note is required; the difference is kept and listed for sign-off.
4. Enter the amount moved to the safe or bank and the float left. A day summary (sales by method, debts given, repayments, refunds, expenses) prints or exports.

## E. Data model and financial integrity

Five ideas carry the model: **Item** is the only thing counted and sold, **documents** record what happened, **stock movements** and **journal entries** are append-only ledgers written by documents, and **allocations** connect payments to what they pay.

### Core entities

| Group | Entities | Notes |
| --- | --- | --- |
| Catalogue | Product (type REGULAR / VARIANT / NUMBERED), Item, OptionType, OptionValue, ItemOptionValue, Barcode, Category, ProductImage | Barcode table: one unique index for every code in the shop. Numbered item stores its photo point. |
| Stock | ItemBalance (on-hand, reserved, damaged), StockMovement, Reservation, StockCount + lines | Balance is a cache of the movements, locked on change. |
| Parties | Customer, Supplier, DeliveryCompany, User | Balances derived from the ledger, never typed. |
| Sales | Sale (source, fulfilment mode, fulfilment status), SaleLine (price, discount, cost snapshot), Return + lines, Exchange (links a return and a sale), Gift data on Sale | One Sale for counter, debt, held and online. |
| Money | Payment (direction in/out, method, amount, reference, shift), PaymentAllocation (payment → sale or bill, amount) | Overpayment = unallocated = credit. |
| Purchasing | PurchaseOrder + lines, Receipt + lines, SupplierBill + lines, SupplierCreditNote, SupplierPayment allocation | Ported from the clinic. |
| Cash | Register, Shift, CashMovement (paid in, paid out, drop), ShiftCount | Expected derived from payments and movements. |
| Ledger | Account (fixed list), JournalEntry, JournalLine | Posted by documents; one entry per document event. |
| Control | ApprovalRequest, AuditLog, IdempotencyKey, Outbox (notifications) | Audit in the same transaction. |

### Inventory transaction model

Every change follows the same path inside one transaction:

1. Lock the ItemBalance rows involved, in item-id order (prevents deadlocks).
2. Check availability (on-hand − reserved ≥ quantity).
3. Insert StockMovement rows (item, quantity ±, reason, unit cost, source document, user).
4. Update ItemBalance; database CHECKs reject anything negative.
5. Post the journal entry for the cost side (inventory → cost of goods, damage loss, giveaway expense).
6. Write the audit row. Commit.

Reservation is a separate row (item, quantity, sale line) that raises `reserved`; release or hand-over removes it. Awaiting receipt is derived from open purchase lines, not stored as stock.

### Ledger accounts and posting rules

Accounts: Cash in drawer, Safe, Bank, Card clearing, Customer receivables, Courier receivables, Inventory, Supplier payables, Customer credit (liability), Gift vouchers (liability), Sales revenue, Discounts given, Cost of goods sold, Operating expenses (by category), Damage and loss, Promotions (giveaways), Other income, Cash over/short, Exchange differences.

| Event | Debit | Credit |
| --- | --- | --- |
| Sale completed (taken), unpaid part | Customer receivables | Sales revenue |
| Payment received in cash | Cash in drawer | Customer receivables |
| Cost of an item sold | Cost of goods sold | Inventory |
| Debt repayment by card | Card clearing | Customer receivables |
| Refund in cash | Customer receivables (or Sales revenue on return) | Cash in drawer |
| Goods returned to shelf | Inventory | Cost of goods sold |
| Overpayment kept as credit | Cash in drawer | Customer credit |
| Store credit used to pay | Customer credit | Customer receivables |
| Held sale deposit | Cash in drawer | Customer credit (until hand-over) |
| Held sale hand-over | Customer credit (the deposit) + Customer receivables (the rest) | Sales revenue |
| Deposit kept on a cancelled held sale | Customer credit | Other income |
| Courier hand-over (cash on delivery) | Courier receivables | Customer receivables |
| Courier settlement less fee | Bank / Cash + Operating expenses (delivery) | Courier receivables |
| Goods received from supplier | Inventory | Supplier payables |
| Supplier paid | Supplier payables | Cash / Bank |
| Expense paid in cash | Operating expenses | Cash in drawer |
| Damaged return / write-off | Damage and loss | Inventory |
| Giveaway | Promotions | Inventory |
| Count shortage | Damage and loss | Inventory |
| Foreign cash banked or exchanged below the rate it was taken at | Exchange differences | Cash in drawer |
| Drawer short at close | Cash over/short | Cash in drawer |
| Cash moved to the safe or bank | Safe / Bank | Cash in drawer |

In practice a counter sale posts revenue and receivable, then the payment clears the receivable in the same transaction, so a fully paid sale nets to cash vs revenue.

**Why double entry and not a simpler model.** A simpler model (payments and expenses tables summed by reports) is what exists today, and it is why cash, revenue and owed money disagree. A full ledger forces every event to say where money came from and where it went, so debt repayments cannot become revenue and purchases cannot become expenses. The cost is about one posting function per document type and a test that each balances. Staff never see it. The alternative of a full accounting package with a chart of accounts editor is rejected as unnecessary.

### Integrity constraints

- Money: `numeric(12,2)` everywhere; rounding half-up in one function. Every payment and cash movement stores currency, original amount and rate; journal lines are always in the default currency.
- CHECKs: balances ≥ 0, reserved ≤ on-hand, returned ≤ sold per line, allocation ≤ open amount, journal entry lines sum to zero (deferred constraint trigger).
- Triggers forbid UPDATE and DELETE on movements, journal lines, payments and audit rows except the reversal stamp (clinic pattern).
- Unique: barcode code, SKU, idempotency key, one open shift per register, one pending approval per entity and field.
- Foreign keys from every movement, payment and journal line to its source document.

### Concurrency

- Row locks (`SELECT ... FOR UPDATE`) on item balances, the customer, the supplier and the shift when their balance changes.
- Status changes are conditional updates (`WHERE status = 'PREPARING'`); zero rows means someone else got there first.
- Every create from the POS carries an idempotency key; the server stores key → result for 7 days.
- Notifications and emails go through an outbox table written in the transaction and sent after commit with retries.
- Tests run checkout, returns, status changes and closes in parallel against a real test database.

## F. UI and UX redesign

One app with two modes: the **back office** (sidebar on desktop, bottom bar on phone) and the **POS workspace**, which opens full screen with its own minimal top bar and a way back. Twelve flat menu items become six groups.

### Navigation

| Group | Screens | Employee | Manager | Admin |
| --- | --- | --- | --- | --- |
| Home | Today (per role), activity feed | Own sales today | Shop figures, no cost | Everything |
| Sell | POS, Orders board, Returns and exchanges | Yes | Yes | Yes |
| Customers | Customers, Debts (aging list), Store credit | Yes | Yes | Yes |
| Stock | Products, Stock and counts, Purchases and receiving, Suppliers, Labels, Categories | Products, labels, receiving | All | All |
| Money | Cash shifts, Expenses, Delivery companies, Reports | Own shift, add expense | All except reports with cost | All |
| Admin | Approvals, Staff, Settings, Audit log | Own requests | Approvals (not own) | All |

The account menu stays in the top bar (name, role, language, sign out, version), as today.

### Desktop layouts

- **Sidebar** with the six groups, collapsible to icons; keyboard search for any screen (Ctrl+K).
- **Lists** are real tables: sortable columns, filters in a bar, saved in the URL, row click opens a **side panel** (split view) so the list stays in place.
- **Detail pages** use two columns: main content and a summary rail (status, money, customer, actions).
- Dense but readable: 14 px table text, 40 px rows, no pull-to-refresh.

### Mobile layouts

- **Bottom bar**, four tabs per role (Employee: Sell, Orders, Products, Customers; Admin: Home, Sell, Orders, More).
- Lists become cards with photo, name and the one number that matters; filters in a sheet.
- Detail opens as a full page with a sticky action bar at the thumb.
- Forms single column, 16 px inputs, numeric keypad for numbers, 44 px targets, safe areas respected (rules kept from today).

### POS workspace

- **Desktop / Windows:** left 60%: search box (always focused), scan feedback, product grid by category with photos. Right 40%: customer chip, cart lines, totals, big **Pay** button. Keyboard: F2 search, F4 customer, F6 discount, F8 pay, F9 hold cart, F10 return, Esc back, +/− quantity.
- **Phone:** scan and search on top, cart below, sticky total and **Pay** bar; the product browser and pickers open as sheets.
- **Payment panel:** total large, one button per method, quick cash amounts, split by adding a second method, Taken/Held switch, remaining balance shown live in plain words ("customer owes 120").
- **Parked carts:** hold a cart and serve the next customer; up to several per till.
- Shift status always visible; a sale without an open shift is refused with a one-tap open.

### Orders screen

- **Board** (desktop) or **tabs with counts** (phone): New, Confirmed, Preparing, Ready, Out.
- Each order card shows: number, source badge (Store, WhatsApp, Online), customer and city, item photos in a strip, total and payment badge (Paid, Partly, Unpaid), age.
- Order detail: a line per item with photo, name, size or number, quantity, price; customer block with call and WhatsApp buttons; payment block with allocations; timeline of status changes.
- **Pick list** printable or on screen, grouped by location, tick as picked.

### Product creation

- First screen: three large cards (Regular, Variant, Numbered) with a picture and one line each.
- Each type opens its own short form (see D). Desktop: form left, live preview (card, label, POS tile) right. Phone: single column, Save sticky at the bottom.
- The current 1,001-line form becomes three forms of roughly 200-300 lines sharing field components.

### Design system

- Tokens for colour, type, spacing and radius in one place; colours written once (as the current rule requires) but in a format iOS 15 reads natively.
- One component library used everywhere (button, field, money input, quantity stepper, table, card, sheet, dialog, badge, empty state).
- Arabic first: Cairo or Tajawal, generous line height (the current rule for Arabic tails stays), full RTL mirroring checked in both themes.
- A visual check in Arabic at 375 px and 1440 px before any screen is accepted.

## Data migration

Everything that exists today moves into the new database by a repeatable script, rehearsed on copies until two runs in a row reconcile exactly; the live system is only read, never changed. The new ledgers start at cut-over from opening balances, and history before that stays readable as imported sales. This is the standard way to start a ledger: imported history is not re-posted as journal entries. Reports for periods before cut-over read the imported sales and are labelled as imported; a period that spans cut-over shows the two parts separately.

Note: customers, debts, suppliers, payments and stock history do not exist in the current system. If the shop keeps them on paper or in Excel, they come in as **opening balances** (see H).

### Mapping

| Today | New | Rule |
| --- | --- | --- |
| Product without variants | Product (REGULAR) + 1 Item | SKU, barcode, price, cost, stock carried over |
| Product with variants | Product (VARIANT) + Item per variant | Option values by reference; inherited price kept empty |
| Numbered shawl | Product (NUMBERED) + Item per number | Photo point and marker colours kept |
| `barcode` and `generatedBarcode` | Barcode rows | Collisions found by the script are listed and must be resolved before cut-over |
| Images and files | Same files, same paths | Volume reattached, not copied over the network; row count and file check |
| Categories, option types and values, notes | Same | Ids preserved where possible |
| Stock numbers | Opening stock movement per item at cut-over | At current cost; unknown cost flagged |
| Orders (store) | Imported Sale (completed) + one cash payment at the order date | Lines with their snapshots |
| Orders (online) | Imported Sale with mapped status; collected = courier payment at collected date; pending = courier receivable |  |
| Returned quantities | Imported Return per order | Date approximated from the order's last update, flagged as imported |
| Customer snapshots on orders | Customer records, de-duplicated by phone (both +970/+972 forms) | Review list for near-duplicates |
| Gifts | Imported Sale marked giveaway |  |
| Expenses, categories | Same, as posted expenses |  |
| Cash sessions | Imported closed shifts on one register | Read-only history |
| Users | Same accounts and roles | Current password hashes verified once at first sign-in, then re-hashed; nobody has to reset |
| Audit log, change requests | Archived read-only table | Searchable from the audit screen |
| Settings | Settings |  |

### Validation

After each run the script prints and checks: counts per table; total stock units and stock value per category; sales totals per month (old vs new); collected vs outstanding courier totals; every barcode resolves to one item; every image file exists. Any difference fails the run.

### Rehearsal and cut-over

1. Build the migration early (phase 1) and run it nightly against a copy of production in the sandbox.
2. Staff use the new system in the sandbox with migrated data for at least a week of real practice.
3. Cut-over night: full backup (database + uploads, the existing ops scripts), old system set read-only, final migration, validation report, smoke test of sell, return, pay and close.
4. Morning: open the first shift on the new system; old system stays reachable read-only for reference.

### Rollback

- Before the first new sale: point the domain back to the old system; nothing is lost.
- After trading starts: the old database is untouched, so rollback means re-entering that day's sales in the old system from the new system's export. The plan is to decide go/no-go by noon of day one.
- Downtime: one evening after closing; zero during trading hours.

## G. Roadmap

Nine phases, money and stock correctness first, built in a new repository (or a new folder) beside the current system, which keeps running until cut-over. Each phase ends with its tests passing in CI and a review by you in the sandbox. Complexity is relative (S, M, L, XL); durations depend on how many review rounds each phase needs.

| Phase | Scope | Depends on | Main risks | Complexity | Tests | Migration |
| --- | --- | --- | --- | --- | --- | --- |
| 0. Foundations | Repo, CI (type check, lint, API tests on a throwaway DB), auth, roles and capabilities, audit, idempotency, outbox, design system, app shell with sidebar and bottom bar, i18n, Safari 15 build check | Decisions in H | Wrong early choices are expensive later | L | Auth, guards, audit-in-transaction, iOS 15 parse check | None |
| 1. Catalogue and stock | Product types, items, barcodes, images (ported), search (ported), stock ledger and balances, adjustments, counts, labels | 0 | Data model must fit numbered shawls and supplier codes first time | L | Barcode uniqueness, concurrent adjustments, count posting, ledger = balance | **Catalogue migration script written and run nightly** |
| 2. Sales, payments, POS | Customers, Sale, payments, allocation, split and partial payment, debt, held goods and reservations, POS workspace, receipts (printable page), registers and shifts, blind count, ledger posting for all of these | 1 | Checkout speed; correctness of posting | XL | Parallel last-item sales, duplicate submit, crash replay, each posting balances, blind count not leaked | Orders, customers, cash history added to the script |
| 3. Returns, exchanges, approvals, gifts | Return and exchange documents, damaged returns, refunds, store credit, approval inbox, giveaways, gift receipts, quick sell and its completion queue | 2 | Edge cases in mixed paid/unpaid returns | L | Returned ≤ sold under concurrency, refund ≤ paid, approval applies deltas | Returns history |
| 4. Orders and fulfilment | Orders board, WhatsApp and online sources, confirm and reserve, pick lists, delivery companies, courier settlements, returned parcels | 2, 3 | Workflow fit for the staff who prepare orders | M | Status transitions under double click, reservation release, courier balance | Online order status and courier balances |
| 5. Suppliers and purchasing | Suppliers, purchases, receiving, bills, credit notes, supplier payments and allocation, weighted-average cost | 1, 2 | Porting the clinic model to items | M | Partial receipt, oldest-first allocation, cost recalculation | Opening supplier balances (if any) |
| 6. Reports and dashboard | Sales, profit and loss, cash flow, cash in hand, debts and aging, supplier debts, inventory valuation, expenses, payment methods, daily summary, export; activity feed and Web Push | 2-5 | Reports must reconcile with the ledger | M | Each report equals the ledger for any period after cut-over | Periods before cut-over shown from imported sales, labelled as imported |
| 7. Windows desktop | Tauri shell, sign-in with secure storage, ESC/POS printing and cash drawer kick, auto-update | 2 | Printer model compatibility | M | Install, update and print on the shop's own PC and printer | None |
| 8. Cut-over | Rehearsals, staff practice week, migration night, day-one support, old system read-only | All | Missed data mapping; staff readiness | M | Full validation report, smoke test | Final run |

**Can phases overlap?** 5 and 7 can start once 2 is done, and 4 once 3 is done; after that they can run in any order you prefer. Cosmetic polish waits until after phase 3.

## H. Open decisions

Fifteen decisions are open. The first five shape the architecture and need your answer before phase 0 starts; the rest can be confirmed at the start of the phase that uses them. My recommendation is in bold.

| # | Decision | Options | Recommendation | Trade-off | Effect on complexity |
| --- | --- | --- | --- | --- | --- |
| 1 | Stack | Vite SPA + NestJS + Drizzle; keep Express + Prisma; Next.js full stack | **Vite SPA + NestJS + Drizzle** (clinic-style) | Same tools and patterns you already run in the clinic, strong integrity tools; the API is rewritten rather than refactored | Lower long-term; one way of working across both products |
| 2 | Where the new code lives | New repository; new folder in this repo; branch replacing this repo | **New repository**, old one archived after cut-over | Clean history and CI; the old code stays a reference | Lower |
| 3 | Editable permissions screen | Keep the editor; fixed roles with capabilities in code | **Fixed roles**, no editor | Simpler and safer; a change in rights needs a release | Removes \~700 lines and a class of mistakes |
| 4 | The iOS 15 phone | Support it fully; support it with listed fallbacks; replace the device | **Support with fallbacks** (push replaced by the in-app feed); a phone on iOS 16.4+ would remove every limitation | Keeping costs care in every screen; replacing costs money once | Moderate either way; much lower if replaced |
| 5 | Exact iOS version on that phone (Settings → General → About) | 15.0-15.3 or 15.4-15.8 | iPhone 7 Plus, believed 15.4; update to 15.8 and confirm in Settings | 15.4+ supports far more CSS | Decides the polyfill list |
| 6 | Cash and card refunds by employees | Always allowed; allowed up to an amount; always manager | **Allowed up to an amount you set; above it a manager approves** | Speed at the counter vs control | Low |
| 7 | Held goods never paid | Shop decides case by case (your rule) | **Case by case, with a reminder after N days**; keeping a deposit is Admin/Manager only | Needs N (for example 30 days) | Low |
| 8 | Revenue date for online orders | When entered; when handed to the courier | **At hand-over** | Matches when goods leave; entered-but-unsent orders are not sales | Low |
| 9 | Opening balances | Start with zero; import customer debts, supplier debts and cash from your records | **Import if you have them** (a spreadsheet template will be provided) | Accurate statements from day one vs extra preparation | Low |
| 10 | Card payments | Record the amount from a separate terminal; integrate with a terminal | **Record from a separate terminal** | No integration cost; staff type the amount and the slip number | Low |
| 11 | Gift vouchers (sold store credit) | Build in phase 3; leave out | **Leave out until asked** | Not mentioned as a current need | Saves a liability flow |
| 12 | Month close | None; lock a month after review | **Lock after review**, Admin can reopen with a reason | Stops back-dated changes to closed periods | Low |
| 13 | Offline POS | Defer; build a cash-only queue on Windows | **Defer**, decide after three months of live use | See section B | Large if built |
| 14 | Shelf locations for pick lists | None; a free-text location per item | **Free-text location**, optional | Faster picking if the stockroom is large | Low |
| 15 | Tills and printers | Need: number of tills and PCs, receipt printer model, label printer model | Need the details | Decides the Windows printing work | Low |

Also confirm: Hebrew stays as the third language, and the website storefront remains a later phase (it would be a separate public app, possibly Next.js, reading the same API). Still needed for currencies: which ones the shop accepts, which is the default, and who sets the exchange rate.
