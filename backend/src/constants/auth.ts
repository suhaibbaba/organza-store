export * from "@store/shared/constants/auth";

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
export const AUTH_DISABLED_PATHS = [
  "/update-user",
  "/change-password",
  "/passkey/list-user-passkeys",
  "/passkey/delete-passkey",
  "/passkey/update-passkey",
];

// Passkey ceremonies stay Better Auth's; listing and removing go through the audited /api/me/passkeys.
export const PASSKEY_VERIFY_REGISTRATION_PATH = "/passkey/verify-registration";
export const PASSKEY_VERIFY_AUTHENTICATION_PATH = "/passkey/verify-authentication";

// What the device's passkey prompt calls the system when PASSKEY_RP_NAME is unset; never a shop's name.
export const PASSKEY_DEFAULT_RP_NAME = "Store Management";

// A person's passkeys: a phone, a laptop and a spare key are the usual set.
export const PROFILE_PASSKEYS_LIMIT = 20;

// The hostname every local app shares; any other one-label domain would be a public suffix.
export const LOCALHOST = "localhost";

// POS unlock and lock-screen lookups per caller: generous for one shop behind one address, useless for guessing.
export const POS_UNLOCK_IP_LIMIT = 30;
export const POS_UNLOCK_IP_WINDOW_MS = 60 * 1000;
