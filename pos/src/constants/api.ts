// Better Auth's own routes, mounted at /api/auth/* on the backend.
export const AUTH_ENDPOINTS = {
  SIGN_IN_EMAIL: "/api/auth/sign-in/email",
  SIGN_OUT: "/api/auth/sign-out",
  GET_SESSION: "/api/auth/get-session",
  PASSKEY_SIGN_IN_OPTIONS: "/api/auth/passkey/generate-authenticate-options",
  PASSKEY_SIGN_IN: "/api/auth/passkey/verify-authentication",
  PASSKEY_REGISTER_OPTIONS: "/api/auth/passkey/generate-register-options",
  PASSKEY_REGISTER: "/api/auth/passkey/verify-registration",
} as const;

export const SESSION_QUERY_KEY = ["session"] as const;
export const PROFILE_QUERY_KEY = ["profile"] as const;
export const PROFILE_SESSIONS_QUERY_KEY = ["profile", "sessions"] as const;
export const PROFILE_PASSKEYS_QUERY_KEY = ["profile", "passkeys"] as const;
export const SETTINGS_QUERY_KEY = ["settings"] as const;

// Each role's actions, loaded with the session and held for the shift.
export const PERMISSIONS_QUERY_KEY = ["permissions"] as const;
export const PRODUCT_SEARCH_QUERY_KEY = ["products", "search"] as const;

// Kept apart from the search key, so opening search never evicts the grid on screen.
export const PRODUCT_BROWSE_QUERY_KEY = ["products", "browse"] as const;

// How many products the till can sell — the figure on the "All" tile.
export const PRODUCT_COUNT_QUERY_KEY = ["products", "count"] as const;
// Categories rarely change, so they are held for the shift.
export const CATEGORIES_QUERY_KEY = ["categories"] as const;
export const CATEGORIES_STALE_TIME_MS = 30 * 60 * 1000;
export const PRODUCT_DETAIL_QUERY_KEY = ["products", "detail"] as const;
export const PRODUCT_LOOKUP_QUERY_KEY = ["products", "lookup"] as const;

// Repeat customers by phone digits typed so far, from past orders' snapshots (there is no Customer table).
export const CUSTOMER_SUGGESTION_QUERY_KEY = ["orders", "customerSuggestions"] as const;
export const CUSTOMER_SEARCH_QUERY_KEY = ["customers", "search"] as const;

// The API's build number, read when something looks stale; never polled.
export const API_VERSION_QUERY_KEY = ["version"] as const;
export const API_VERSION_STALE_TIME_MS = 5 * 60 * 1000;

// Too many sign-in attempts, told apart on screen from a wrong password.
export const HTTP_TOO_MANY_REQUESTS = 429;

// POS quick unlock (spec.md "POS passcode and lock").
export const POS_DEVICE_ENDPOINTS = {
  ENROLL: "/api/pos-devices/enroll",
  PASSCODE: "/api/pos-devices/passcode",
  MEMBERS: "/api/pos-devices/members",
  UNLOCK: "/api/pos-devices/unlock",
  LEAVE: "/api/pos-devices/leave",
} as const;
export const POS_ENROLLMENT_QUERY_KEY = ["posDevice", "enrollment"] as const;
export const POS_MEMBERS_QUERY_KEY = ["posDevice", "members"] as const;
// Store-wide answers that stay valid when a different person unlocks the till.
export const SHARED_QUERY_ROOTS: readonly string[] = ["settings", "version"];

// Exchanges: past sales to swap pieces from, one sale in full, and what its chosen pieces carry over.
export const EXCHANGE_ORDERS_QUERY_KEY = ["orders", "exchangeSearch"] as const;
export const ORDER_DETAIL_QUERY_KEY = ["orders", "detail"] as const;
export const EXCHANGE_PREVIEW_QUERY_KEY = ["orders", "exchangePreview"] as const;
