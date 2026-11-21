// Better Auth's own routes, mounted at /api/auth/* on the backend.
export const AUTH_ENDPOINTS = {
  SIGN_IN_EMAIL: "/api/auth/sign-in/email",
  SIGN_OUT: "/api/auth/sign-out",
  GET_SESSION: "/api/auth/get-session",
} as const;

export const SESSION_QUERY_KEY = ["session"] as const;
export const PROFILE_QUERY_KEY = ["profile"] as const;
export const PROFILE_SESSIONS_QUERY_KEY = ["profile", "sessions"] as const;
export const SETTINGS_QUERY_KEY = ["settings"] as const;
export const PUSH_CONFIG_QUERY_KEY = ["push", "config"] as const;
export const CATEGORIES_QUERY_KEY = ["categories"] as const;
// Each role's actions, loaded with the session and pushed into can().
export const PERMISSIONS_QUERY_KEY = ["permissions"] as const;
export const VARIANT_TYPES_QUERY_KEY = ["variantTypes"] as const;
export const DASHBOARD_SUMMARY_QUERY_KEY = ["dashboard", "summary"] as const;

// The API's build number, read when something looks stale; never polled.
export const API_VERSION_QUERY_KEY = ["version"] as const;
// Keyed by token, so a second pasted link is checked afresh.
export const PASSWORD_TOKEN_QUERY_KEY = "passwordToken";
export const API_VERSION_STALE_TIME_MS = 5 * 60 * 1000;

// Too many sign-in attempts, told apart on screen from a wrong password.
export const HTTP_TOO_MANY_REQUESTS = 429;
