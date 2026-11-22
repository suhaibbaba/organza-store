// Better Auth answers in its own shape, not our envelope, so these codes are what the login screens read back.

// A deactivated account signing in: its password is fine, so the screen must not send it round the reset loop.
export const ACCOUNT_INACTIVE_AUTH_CODE = "ACCOUNT_INACTIVE";

// Adding a passkey needs a sign-in from the last day; older sessions are asked to sign in again.
export const SESSION_NOT_FRESH_AUTH_CODE = "SESSION_NOT_FRESH";

// A passkey the device still offers but the account no longer accepts (removed from My profile).
export const PASSKEY_NOT_FOUND_AUTH_CODE = "PASSKEY_NOT_FOUND";
