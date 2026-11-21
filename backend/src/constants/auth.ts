export * from "@organza/shared/constants/auth";

// Better Auth's own provider id for the email+password credential account.
export const AUTH_PROVIDER_CREDENTIAL = "credential";

// Fallback session lifetime when SESSION_EXPIRES_IN_DAYS is not set.
export const DEFAULT_SESSION_EXPIRES_IN_DAYS = 7;

// Sign-in rate limit per caller: Better Auth's default 3 per 10s locks a shared shop IP out at opening time.
export const SIGN_IN_RATE_LIMIT_WINDOW_SECONDS = 60;
export const SIGN_IN_RATE_LIMIT_MAX = 20;

/** Better Auth's sign-in path, relative to its own base path. */
export const SIGN_IN_EMAIL_PATH = "/sign-in/email";

// A person's own devices; far more than one shop phone and a laptop would ever hold.
export const PROFILE_SESSIONS_LIMIT = 50;

// Better Auth endpoints answered 404: a person edits their own account only through the audited /api/me.
export const AUTH_DISABLED_PATHS = ["/update-user", "/change-password"];
