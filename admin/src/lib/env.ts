import { resolveAppEnv } from "@shared/constants/appEnv";

// NEXT_PUBLIC_* vars are inlined at build time and safe to read on the client.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
// Stamped in at build time by next.config.ts (<major>.<minor> from
// package.json + the repo's commit count). The fallback only ever shows in a
// build that skipped the config — a dev server started oddly — and is
// deliberately obviously-not-a-release.
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

// Which deployment this build belongs to — the sandbox stack or the live shop
// (@shared/constants/appEnv). Stated rather than inferred: both stacks run
// with NODE_ENV=production, so nothing else in the bundle can tell them apart.
//
// process.env.NEXT_PUBLIC_APP_ENV is written out in full because that is what
// Next replaces with the value at build time — a computed lookup would still
// be a lookup at runtime, where the browser has no environment to read.
export const APP_ENV = resolveAppEnv(process.env.NEXT_PUBLIC_APP_ENV);
/** True on the throwaway stack — see components/layout/environment-badge.tsx. */
export const IS_SANDBOX = APP_ENV === "sandbox";
