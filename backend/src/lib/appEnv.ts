import "dotenv/config";
import { resolveAppEnv } from "@shared/constants/appEnv";
import type { AppEnv } from "@shared/types";

/*
 * Which deployment this process is: the sandbox stack, or the live shop.
 *
 * `NODE_ENV` cannot answer that. Both stacks run the same compiled build with
 * `NODE_ENV=production`, so every check written against it was really asking
 * "is this a production *build*" while sounding like it asked "is this the
 * shop's real data" — which is how `db:reset`'s "that is the LIVE SHOP"
 * refusal came to fire on the sandbox as well, on a database that exists to
 * be wiped. A refusal that is wrong half the time teaches people to type past
 * it, so the environment is now declared rather than guessed (APP_ENV, see
 * @shared/constants/appEnv for what an unset value means and why).
 *
 * The frontends read the same value under NEXT_PUBLIC_APP_ENV, which is also
 * what picks their icon set — so a deploy sets one thing per app and the
 * tiles, the names and this guard agree.
 */

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

/**
 * The value as it stood when the process started.
 *
 * For the things that are decided once and then baked into something else —
 * the Sentry environment tag, the icon folder a password email links to. They
 * read this rather than calling the function so that one request cannot send
 * a mail pointing at a different environment's logo than the last.
 */
export const APP_ENV: AppEnv = currentAppEnv();
