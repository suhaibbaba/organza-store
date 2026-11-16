# Patterns taken from the clinic system (and where this repo differs)

Reference only; nothing in the clinic repo is changed.

- **Layout:** pnpm workspaces `apps/*`, `packages/*`. API modules `src/modules/<m>/{<m>.module.ts,controllers,services,dto,lib,constants.ts}`; a module's `lib` and `constants` are private (ESLint `no-restricted-imports`); shared code in `src/common`. Shared Zod schemas in `packages/shared`, the API wraps them in DTOs and validates with a global Zod pipe.
- **Auth:** argon2id (memoryCost 19456, timeCost 2), login throttle (5 fails / 15 min → 15 min lock), decoy hash when the user is missing. HS256 access JWT 15 min, reloaded session state checks active/role. Refresh token = 32 random bytes, stored as sha256, rotated on every refresh with `replaced_by`; a revoked token presented again revokes all the user's tokens (reuse detection); revoke is an atomic conditional update. httpOnly cookie, SameSite Lax.
- **Capabilities:** `@Roles(...)` default roles on routes; key `<controller-kebab>.<method>`, discovered at bootstrap. Guard: public → no roles → admin → role in defaults. Login returns the capability list; web `can(key)`.
  - *Here:* fixed roles, no override table (decision H3).
- **Audit:** clinic audits through an interceptor after the handler and only sometimes in the transaction.
  - *Here:* audit is always written with the transaction handle by the service (rule 3); there is no interceptor-based audit.
- **Unit of work:** AsyncLocalStorage + Proxy over `db` so nested calls join one transaction; after-commit effects queue.
  - *Here:* used for every write; after-commit is used only to wake the outbox sender (the outbox row itself is written in the transaction).
- **Idempotency:** clinic uses `request_id` columns with partial unique indexes and replay on 23505.
  - *Here:* a dedicated `idempotency_keys` table (key, scope, user, request hash, response, created_at, 7 days) written in the same transaction, plus the same replay on unique violation.
- **Append-only:** trigger functions `forbid_rewrite()`, `forbid_hard_delete()`, `guard_ledger_row(whitelist...)` (only whitelisted columns such as `reversed_at` may change; a reversed row stays reversed). Reversal = stamp `reversed_at` on the original + insert a row with `reverses_id`. Row locks with `FOR UPDATE` in sorted id order.
- **Purchasing:** document counters `(kind, year, last)` via upsert; receipts → stock movements; invoices; allocations with payment-or-credit check; oldest-first spread; credit notes post negative value adjustments; void reverses allocations; month lock check before posting.
- **Migrations:** drizzle-kit generated SQL plus hand-written custom SQL for triggers, applied by the drizzle migrator from `dist/database/migrate.js`.
- **Tests:** global setup creates `<db>_test` and migrates; each spec builds the full Nest app with Fastify and uses `app.inject`; isolation by fresh data per spec; one worker.
- **Web:** access token in memory only; refresh cookie; single-flight refresh on 401 then retry once; `restoreSession()` at boot. TanStack Query: staleTime 30 s, no retry on 4xx, mutations never retry. i18next with Arabic bundled, others lazy. Dev proxy `/api` → `:3000`.
