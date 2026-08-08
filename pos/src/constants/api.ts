// Better Auth's own routes, mounted at /api/auth/* on the backend (see
// backend/src/index.ts). Not part of our REST resource routes.
export const AUTH_ENDPOINTS = {
  SIGN_IN_EMAIL: "/api/auth/sign-in/email",
  SIGN_OUT: "/api/auth/sign-out",
  GET_SESSION: "/api/auth/get-session",
} as const;

export const SESSION_QUERY_KEY = ["session"] as const;
export const SETTINGS_QUERY_KEY = ["settings"] as const;
export const PRODUCT_SEARCH_QUERY_KEY = ["products", "search"] as const;
// The product browser's grid — a page of a category (optionally narrowed by
// its own search box), kept apart from the search box's key so opening the
// drawer never evicts the results the cashier already has on screen.
export const PRODUCT_BROWSE_QUERY_KEY = ["products", "browse"] as const;
// The shop's shelves, for the browser's sidebar. Changed from the admin
// perhaps once a season, so it is held for the shift.
export const CATEGORIES_QUERY_KEY = ["categories"] as const;
export const CATEGORIES_STALE_TIME_MS = 30 * 60 * 1000;
export const PRODUCT_DETAIL_QUERY_KEY = ["products", "detail"] as const;
export const PRODUCT_LOOKUP_QUERY_KEY = ["products", "lookup"] as const;
// Repeat customers, matched on the phone digits typed so far (there is no
// Customer entity — these come out of past orders' snapshots).
export const CUSTOMER_SUGGESTION_QUERY_KEY = ["orders", "customerSuggestions"] as const;

// The running API's build number (GET /api/version) — read out alongside the
// app's own when something looks stale, never polled.
export const API_VERSION_QUERY_KEY = ["version"] as const;
export const API_VERSION_STALE_TIME_MS = 5 * 60 * 1000;
