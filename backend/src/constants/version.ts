// Application version (see lib/version.ts and GET /api/version).

/**
 * Env var the deploy bakes the resolved version into. Set as a Docker build
 * arg, because the image has no git history of its own to count from.
 */
export const APP_VERSION_ENV_VAR = "APP_VERSION";

/**
 * The shared resolver, relative to this app's compiled/executed lib directory
 * (src/lib in dev, dist/lib in the image — both two levels below the project,
 * three below the repo root, where shared/ sits beside backend/).
 */
export const APP_VERSION_RESOLVER_PATH = "../../../shared/scripts/app-version.js";

/** Used only when neither the env var nor the git history can answer. */
export const FALLBACK_APP_VERSION = "0.0.0";
