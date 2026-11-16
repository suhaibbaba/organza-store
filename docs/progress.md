# Progress

**Current phase:** 1. Catalogue and stock
**Next:** stock adjustments and counts (API), then the image pipeline and labels

## Finished steps

| Date | Phase | Step | Commit |
| --- | --- | --- | --- |
| 2026-11-16 | 0 | Monorepo skeleton: pnpm workspaces, TypeScript 6, ESLint, Prettier, shared package with money arithmetic and tests | see git log |
| 2026-11-16 | 0 | API skeleton: NestJS 11 on Fastify, env validation, Drizzle + postgres-js, unit of work, error format, plain SQL migrations with append-only trigger functions, throwaway test database, health check | see git log |
| 2026-11-16 | 0 | Auth (argon2, 15-min access JWT, rotating refresh token with reuse detection, httpOnly cookie or desktop body token, login lockout), fixed roles with capabilities and a boot-time coverage check, staff management, audit in the same transaction, idempotency keys, outbox with retries | see git log |
| 2026-11-16 | 0 | Web app shell: Vite 8 + React 19 + Mantine 9, Arabic-first i18n (ar/en/he) with RTL, sidebar with six groups and Ctrl+K screen search, phone bottom bar, root never scrolls, sign-in with in-memory access token and single-flight refresh, staff screen, design tokens, PWA manifest; checks for Safari 15.4 build output, banned CSS and i18n key parity. Visually checked in Arabic at 1440 px and 375 px | see git log |
| 2026-11-16 | 0 | CI workflow (format, type check, lint, API tests on a throwaway Postgres 17, web build + Safari check, image builds), API and web Dockerfiles, nginx, production compose, README. Phase 0 complete | see git log |
| 2026-11-16 | 1 | Shop settings (one validated document with defaults: labels, thresholds, reminders) and currencies (one default, others with an append-only rate history) | see git log |
| 2026-11-16 | 1 | Money and stock ledgers: 20 fixed accounts, balanced journal entries (deferred DB check), reversal by mirror entry, period locks; stock movements with ON_HAND/DAMAGED buckets, cached balances with CHECKs, sorted row locks, weighted average cost, reservations, source reversal, nightly balance check. Catalogue API: categories, option types and values, products of the three types created in one transaction with opening stock, EAN-13 (prefix 200) and SKUs, barcode uniqueness with shared supplier codes and lookup, Arabic search (pg_trgm), versioned edits, archive with write-off, unknown-cost fill-in. Tests: oversell under concurrency, ledger = balances, append-only | see git log |
