import type { APP_ENVS } from "@/constants/appEnv";

// The deployment a build belongs to — "sandbox" or "production". Derived from
// the constant so the list stays in one place (see constants/appEnv.ts).
export type AppEnv = (typeof APP_ENVS)[number];
