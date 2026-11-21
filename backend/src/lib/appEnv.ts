import "dotenv/config";
import { resolveAppEnv } from "@store/shared/constants/appEnv";
import type { AppEnv } from "@store/shared/types";

// Which deployment this is (sandbox or live shop); NODE_ENV cannot tell, both stacks run production builds.

/** Read fresh each call, so `APP_ENV=production npm run db:reset` is honoured. */
export function currentAppEnv(): AppEnv {
  return resolveAppEnv(process.env.APP_ENV);
}

/** The live shop. Guard destructive work with this, never with NODE_ENV. */
export function isProductionAppEnv(): boolean {
  return currentAppEnv() === "production";
}

/** Whether APP_ENV was actually set, so a refusal can say "unset" honestly. */
export function isAppEnvDeclared(): boolean {
  return Boolean(process.env.APP_ENV?.trim());
}

/** Frozen at start-up, so the Sentry tag and email logos never switch environment mid-process. */
export const APP_ENV: AppEnv = currentAppEnv();
