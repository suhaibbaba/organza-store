export * from "@organza/shared/constants/permissions";

/**
 * How long a process will serve its cached permission matrix before it asks
 * the database whether anything changed (lib/permissionConfig.ts).
 *
 * The probe is one row of two aggregates over a table of a few dozen rows —
 * cheap, but not free, and `can()` is called dozens of times per request, so
 * it is never on that path. It happens at most once per window, on the way
 * through requireAuth, which is already awaiting a session lookup.
 *
 * What the number buys: the process that made the change refreshes itself
 * immediately, so a screen never shows a stale answer to the person who just
 * clicked. Every OTHER process — a second container, a worker — is at most
 * this far behind. Five seconds is chosen against what the delay actually
 * costs: somebody's permission takes a moment longer to arrive on a till they
 * are not currently looking at. Nothing is ever wrong for longer than the
 * window, because the version stamp only moves forward.
 */
export const PERMISSION_CACHE_TTL_MS = 5_000;
