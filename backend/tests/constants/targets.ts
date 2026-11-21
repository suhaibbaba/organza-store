// The suite writes real orders and stock, so the target is classified first and anything but the sandbox must be asked for.

// The deployment's own addresses come from the environment, never from code: the system serves more than one shop.
export const SANDBOX_API_URL_ENV = "SANDBOX_API_URL";
export const PRODUCTION_API_URL_ENV = "PRODUCTION_API_URL";

// With neither API_URL nor SANDBOX_API_URL set, the suite targets a developer's own machine.
export const DEFAULT_API_URL = "http://localhost:4000";

// Prefixes stripped from the production API host so its site and www hosts count as the live shop too.
export const PRODUCTION_HOST_PREFIXES = ["api.", "www."] as const;

// A host is a sandbox when its name says so, on a label boundary ("notasandbox.com" is not).
export const SANDBOX_HOST_PATTERN = /(^|[.-])sandbox([.-]|$)/i;

// A developer's own machine: a disposable database by definition.
export const LOCAL_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "host.docker.internal"] as const;

// "Yes, the live shop" must be typed in full: a bare "1" is too easy to leave in a profile.
export const PRODUCTION_OVERRIDE_ENV = "STORE_ALLOW_PRODUCTION";
export const PRODUCTION_OVERRIDE_VALUE = "I-KNOW-THIS-IS-PRODUCTION";

// Leaves fixtures behind for debugging a failure by hand; never set in a normal run.
export const KEEP_FIXTURES_ENV = "STORE_KEEP_FIXTURES";

// Lets the drawer suite open today's drawer; disposable databases only, as a day's drawer cannot be deleted.
export const ALLOW_TODAY_DRAWER_ENV = "STORE_ALLOW_TODAY_DRAWER";

export const TARGET_KINDS = ["sandbox", "local", "production", "unrecognised"] as const;

// Only these run without ceremony: an unknown host is treated as production, so a typo'd URL is never assumed harmless.
export const SAFE_TARGET_KINDS = ["sandbox", "local"] as const;
