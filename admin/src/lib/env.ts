import { resolveAppEnv } from "@store/shared/constants/appEnv";

// NEXT_PUBLIC_* vars are inlined at build time and safe to read on the client.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
// The installed app's own name, set per deployment as a build arg.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Store Admin";
// Stamped in by next.config.ts; the fallback is deliberately obviously not a release.
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

// Stated, not inferred: both stacks run NODE_ENV=production; written out in full so Next inlines it.
export const APP_ENV = resolveAppEnv(process.env.NEXT_PUBLIC_APP_ENV);
/** True on the throwaway stack — see components/layout/environment-badge.tsx. */
export const IS_SANDBOX = APP_ENV === "sandbox";
