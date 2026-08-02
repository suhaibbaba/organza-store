// Bearer session token (see backend `bearer` plugin) — mirrored into both
// localStorage (read by client code) and a plain cookie (read by proxy.ts
// for the optimistic redirect, since proxy can't read localStorage).
export const SESSION_TOKEN_KEY = "organza_admin_session_token";

// Matches the backend's default SESSION_EXPIRES_IN_DAYS (backend/.env.example)
// — only used as the cookie's Max-Age; the backend is the source of truth
// for actual session validity.
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
