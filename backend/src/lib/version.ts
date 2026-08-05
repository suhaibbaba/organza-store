import path from "node:path";
import { APP_VERSION_ENV_VAR, APP_VERSION_RESOLVER_PATH, FALLBACK_APP_VERSION } from "@/constants";

// Which build of the API is running, in the same shape as the admin/POS
// version line (<major>.<minor>.<commit count> — see shared/scripts/
// app-version.js). Staff read their app's version out when they report a
// problem; this is the other half of that answer.
//
// In a container the version is baked in as APP_VERSION at build time, because
// there is no git history in the image to count (.dockerignore excludes .git).
// Running from a checkout — local dev — there is no env var and the resolver
// counts commits itself, which is why it is loaded from disk rather than
// imported: it is a build-time script living outside src/, resolved relative
// to this file so it works the same from src/ (tsx) and from dist/ (node).

interface AppVersionResolver {
  resolveAppVersion(options: { projectDir?: string; envValue?: string }): string;
}

function loadResolver(): AppVersionResolver | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(path.resolve(__dirname, APP_VERSION_RESOLVER_PATH)) as AppVersionResolver;
  } catch {
    // Shared package missing or unreadable — the env var below still answers
    // in every deployed environment, and a version line is never worth
    // failing a boot over.
    return null;
  }
}

// Resolved once: the answer cannot change while the process is alive, and
// shelling out to git on every request would be silly.
const version: string = (() => {
  const envValue = process.env[APP_VERSION_ENV_VAR]?.trim();
  if (envValue) return envValue;

  const resolver = loadResolver();
  if (!resolver) return FALLBACK_APP_VERSION;

  // The backend's own package.json supplies major.minor.
  return resolver.resolveAppVersion({ projectDir: path.resolve(__dirname, "..", "..") });
})();

export function getAppVersion(): string {
  return version;
}
