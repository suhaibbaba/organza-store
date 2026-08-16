export * from "@organza/shared/constants/auth";

// Better Auth's own provider id for the email+password credential account.
export const AUTH_PROVIDER_CREDENTIAL = "credential";

// Fallback session lifetime when SESSION_EXPIRES_IN_DAYS is not set.
export const DEFAULT_SESSION_EXPIRES_IN_DAYS = 7;

// --- signing in: how often somebody may try -------------------------------
//
// Better Auth turns its own rate limiting on as soon as NODE_ENV is not
// "development" — which is every deployed environment — and its built-in rule
// for /sign-in/* is THREE attempts per TEN seconds. A limit is right; that
// number is not, for this shop:
//
//   * it counts by client IP, and when the address cannot be resolved (a
//     reverse proxy that does not forward one, or forwards two hops) Better
//     Auth falls back to ONE shared bucket for every caller. Three sign-ins
//     per ten seconds for the whole shop is a morning where the second person
//     to open the till is told their password is wrong;
//   * even per person it is spent by ordinary use. Somebody who has just
//     chosen a password, mistypes it twice on a phone keyboard and then types
//     it correctly is refused on the attempt that was RIGHT — and a refusal
//     here is a 429 that the login screen cannot tell apart from a bad
//     password. "I set my password and it says it's wrong" is exactly what
//     that looks like from the shop floor.
//
// So the window is widened and the count raised to something a person cannot
// reach by hand but a script still trips over, and the frontends now say "too
// many attempts, wait a moment" rather than "wrong password" when they see a
// 429 (admin/pos lib/auth/client.ts). This is the same reasoning as the
// deliberately loose per-caller limit on the password endpoints (see
// constants/passwordSetup.ts): one IP is not one person here.
export const SIGN_IN_RATE_LIMIT_WINDOW_SECONDS = 60;
export const SIGN_IN_RATE_LIMIT_MAX = 20;

/** Better Auth's sign-in path, relative to its own base path. */
export const SIGN_IN_EMAIL_PATH = "/sign-in/email";
