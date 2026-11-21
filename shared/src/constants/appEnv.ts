// Which deployment this is, stated (backend APP_ENV, apps NEXT_PUBLIC_APP_ENV at build) because both stacks run NODE_ENV=production.
export const APP_ENVS = ["sandbox", "production"] as const;

/** Unset or misspelled means production: guessing sandbox would drop db:reset's second confirmation on the live shop. */
export const DEFAULT_APP_ENV = "production";

/** The SBX of the sandbox icons' amber band, short enough to survive iOS truncating the home-screen name. */
export const SANDBOX_NAME_SUFFIX = "SBX";

/** Normalizes whatever the environment actually holds — see DEFAULT_APP_ENV. */
export function resolveAppEnv(value: string | null | undefined): (typeof APP_ENVS)[number] {
  const normalized = (value ?? "").trim().toLowerCase();
  return APP_ENVS.find((appEnv) => appEnv === normalized) ?? DEFAULT_APP_ENV;
}

/** One folder per environment under each app's public/; the backend builds email logo URLs from it too (constants/email.ts). */
export const appIconBasePath = (appEnv: (typeof APP_ENVS)[number]): string => `/app_icon/${appEnv}`;

/** `<base>/icon-<size>.png`, the square PNG of that size. */
export const appIconPath = (appEnv: (typeof APP_ENVS)[number], size: number): string =>
  `${appIconBasePath(appEnv)}/icon-${size}.png`;
