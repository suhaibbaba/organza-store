// Better Auth's own routes, mounted at /api/auth/* on the backend (see
// backend/src/index.ts). Not part of our REST resource routes.
export const AUTH_ENDPOINTS = {
  SIGN_IN_EMAIL: "/api/auth/sign-in/email",
  SIGN_OUT: "/api/auth/sign-out",
  GET_SESSION: "/api/auth/get-session",
} as const;

export const SESSION_QUERY_KEY = ["session"] as const;
export const SETTINGS_QUERY_KEY = ["settings"] as const;
export const PUSH_CONFIG_QUERY_KEY = ["push", "config"] as const;
export const CATEGORIES_QUERY_KEY = ["categories"] as const;
export const VARIANT_TYPES_QUERY_KEY = ["variantTypes"] as const;
export const DASHBOARD_SUMMARY_QUERY_KEY = ["dashboard", "summary"] as const;

// The running API's build number (GET /api/version) — read out alongside the
// app's own when something looks stale, never polled.
export const API_VERSION_QUERY_KEY = ["version"] as const;
// Checking an emailed set-password link. Keyed by the token so a second link
// pasted into the same tab is checked afresh rather than reusing the answer
// about the first one.
export const PASSWORD_TOKEN_QUERY_KEY = "passwordToken";
export const API_VERSION_STALE_TIME_MS = 5 * 60 * 1000;
