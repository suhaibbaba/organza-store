// Mirrored to a cookie because proxy.ts can't read localStorage.
export const SESSION_TOKEN_KEY = "store_admin_session_token";

// Cookie Max-Age only; the backend decides session validity.
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const SIDEBAR_COLLAPSED_KEY = "store_admin_sidebar_collapsed";
export const SIDEBAR_COLLAPSED_EVENT = "store:sidebar-collapsed";
// Last query string each page had in this tab, so the breadcrumb returns to a list as it was left.
export const RETURN_QUERIES_KEY = "store_admin_return_queries";
