// NEXT_PUBLIC_* vars are inlined at build time and safe to read on the client.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
// Stamped in at build time by next.config.ts (<major>.<minor> from
// package.json + the repo's commit count). The fallback only ever shows in a
// build that skipped the config — a dev server started oddly — and is
// deliberately obviously-not-a-release.
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
