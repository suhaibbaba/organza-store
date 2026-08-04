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
export const PRODUCT_DETAIL_QUERY_KEY = ["products", "detail"] as const;
export const PRODUCT_LOOKUP_QUERY_KEY = ["products", "lookup"] as const;
// Repeat customers, matched on the phone digits typed so far (there is no
// Customer entity — these come out of past orders' snapshots).
export const CUSTOMER_SUGGESTION_QUERY_KEY = ["orders", "customerSuggestions"] as const;
