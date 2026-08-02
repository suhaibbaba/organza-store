// Retry/backoff for Better Auth's sign-in rate limit (HTTP 429). Sessions
// are cached and shared across the whole suite (see tests/support/auth.ts
// + vitest.config.ts's isolate:false/singleFork), so in practice this only
// ever needs to absorb a handful of sign-ins total — this is a safety net
// for whatever rate-limit window the target API happens to be running.
export const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const AUTH_RATE_LIMIT_BASE_DELAY_MS = 500;
