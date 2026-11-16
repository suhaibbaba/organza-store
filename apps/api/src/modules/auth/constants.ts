export const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
export const REFRESH_TOKEN_BYTES = 32;
export const SESSION_REFRESH_TTL_HOURS = 12;
export const REFRESH_COOKIE_NAME = 'organza_refresh';
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MINUTES = 15;
export const LOGIN_LOCK_MINUTES = 15;
export const SESSION_CACHE_MS = 10_000;
