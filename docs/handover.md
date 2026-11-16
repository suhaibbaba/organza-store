# Handover

Where the rebuild stands at the end of phases 0–7, what is left, and how to pick it up. Phase 8
(cut-over) was not started: it touches the live shop and is to be run together.

## State

- **Branch:** `rebuild` (orphan, no pull requests), every step pushed with format, type check,
  lint and tests green locally and in CI.
- **Phases 0–6:** done and checked in the browser at desktop and phone width.
- **Phase 7:** everything that does not need the shop's PC or printer is built. CI compiles,
  lints and tests the Windows shell and builds an unsigned installer. The checks that need the
  hardware are listed in `docs/blocked.md`, in the order to run them.
- **Tests:** API 132 end-to-end tests against a throwaway PostgreSQL 17 database; web 20 unit
  tests (money and format helpers, CSV, ESC/POS encoder); Rust 4 tests (printer targets, raw
  delivery over TCP, secret-key guard).

## What exists

| Area | Where |
| --- | --- |
| Catalogue, images, labels, stock, counts | phase 1 rows in `docs/progress.md` |
| Till, shifts, customers, payments, history import | phase 2 |
| Returns, exchanges, voids, approvals, quick sell | phase 3 |
| Orders, picking, couriers and settlements | phase 4 |
| Suppliers, purchase orders, receiving at landed cost, supplier payments and credit notes | phase 5 |
| Reports from the ledger, Today per role, activity feed, CSV export | phase 6 |
| Windows shell: secure token store, ESC/POS raster printing, cash drawer, updates, This device screen | phase 7 |

Design decisions taken without asking are in `docs/assumptions.md` (50 rows, each with its
reason). The ones most worth a second look:

- **12–14:** how debt, store credit and deposits are kept apart.
- **42–44:** what managers can and cannot see in reports.
- **46:** a fix found by the new stock-value report. The first purchase cost now also prices
  no-cost pieces already on hand.
- **47:** receipts print as a picture so Arabic prints correctly.

## Before cut-over (phase 8)

1. Restore a production dump somewhere safe and run both import rehearsals
   (`import:catalogue`, then `import:history`); read the warnings. See `docs/blocked.md`.
2. Decide the open items in the proposal's decisions table, especially 15 (tills and printer
   models).
3. Updater key, shop domain, CORS origins, code-signing certificate: `docs/blocked.md`, phase 7.
4. Run the shop-PC checklist in `docs/blocked.md` with the CI installer.
5. Cut-over itself follows proposal section G, phase 8: freeze, final import, opening balances
   (cash count, customer debts, supplier balances) as the ledger's first entries.

## Working on it

- Commands: `README.md`. Patterns carried over from the clinic project: `docs/clinic-patterns.md`.
- What was ported from the old system and how: `docs/port-notes.md`.
- Translations live in `apps/web/src/i18n/locales/{ar,en,he}.json`. `pnpm lint` fails on a
  missing key or on an Arabic or Hebrew literal in code.
- **New money or stock movements:** go through `StockService.apply` and `LedgerService.post`
  inside `inTransaction` with an audit entry. The append-only triggers reject anything else.
- **Rust:** none is installed on the machine this was built on, so the Rust code has only been
  compiled by CI (green on Windows and Linux, run 43907073852). Wherever Rust is installed, run
  `cargo fmt` once, then commit `apps/desktop/src-tauri/Cargo.lock` so builds are repeatable.
- **Trying the app now:** download the `organza-windows-installer` artifact from the latest CI
  run on `rebuild` (unsigned, kept 14 days). It talks to the placeholder API address until
  `apps/web/.env.desktop` has the real domain.
