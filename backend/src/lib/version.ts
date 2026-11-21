import path from "node:path";
import { APP_VERSION_ENV_VAR, APP_VERSION_RESOLVER_PATH, FALLBACK_APP_VERSION } from "@/constants";

// The running API's version, <major>.<minor>.<commits> like the apps; APP_VERSION in containers, git locally.

interface AppVersionResolver {
  resolveAppVersion(options: { projectDir?: string; envValue?: string }): string;
}

function loadResolver(): AppVersionResolver | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(path.resolve(__dirname, APP_VERSION_RESOLVER_PATH)) as AppVersionResolver;
  } catch {
    // Shared package unreadable: APP_VERSION still answers, and a version is never worth failing boot.
    return null;
  }
}

// Resolved once; it cannot change while the process lives.
const version: string = (() => {
  const envValue = process.env[APP_VERSION_ENV_VAR]?.trim();
  if (envValue) {
    return envValue;
  }

  const resolver = loadResolver();
  if (!resolver) {
    return FALLBACK_APP_VERSION;
  }

  // The backend's own package.json supplies major.minor.
  return resolver.resolveAppVersion({ projectDir: path.resolve(__dirname, "..", "..") });
})();

export function getAppVersion(): string {
  return version;
}
