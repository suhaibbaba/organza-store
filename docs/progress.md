# Progress

**Current phase:** 0. Foundations
**Next:** web app shell (Vite + React 19 + Mantine, RTL, i18n, sidebar and bottom bar, sign-in, Safari 15 build check)

## Finished steps

| Date | Phase | Step | Commit |
| --- | --- | --- | --- |
| 2026-11-16 | 0 | Monorepo skeleton: pnpm workspaces, TypeScript 6, ESLint, Prettier, shared package with money arithmetic and tests | see git log |
| 2026-11-16 | 0 | API skeleton: NestJS 11 on Fastify, env validation, Drizzle + postgres-js, unit of work, error format, plain SQL migrations with append-only trigger functions, throwaway test database, health check | see git log |
| 2026-11-16 | 0 | Auth (argon2, 15-min access JWT, rotating refresh token with reuse detection, httpOnly cookie or desktop body token, login lockout), fixed roles with capabilities and a boot-time coverage check, staff management, audit in the same transaction, idempotency keys, outbox with retries | see git log |
