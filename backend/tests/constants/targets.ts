// Which API the suite is allowed to point at, and what it takes to point it
// at one that holds the shop's real money.
//
// The suite is not a unit test rig: every assertion in it creates real
// orders, real expenses and real stock movements against a live database.
// Run against the sandbox that is exactly what is wanted; run against
// production it is a stranger ringing up sales on the shop's till. So the
// target is classified before a single request goes out, the sandbox is the
// default, and anything else has to be asked for explicitly.

export const SANDBOX_API_URL = "https://api.sandbox.organza-moda.com";
export const PRODUCTION_API_URL = "https://api.organza-moda.com";

// The live shop. Anything here needs the override below.
export const PRODUCTION_HOSTS = [
  "api.organza-moda.com",
  "organza-moda.com",
  "www.organza-moda.com",
] as const;

// A host is a sandbox when it says so in its name — api.sandbox.organza-moda.com,
// sandbox.example.test, ... Matched on a label boundary so "notasandbox.com"
// is not mistaken for one.
export const SANDBOX_HOST_PATTERN = /(^|[.-])sandbox([.-]|$)/i;

// A developer's own machine: a disposable database by definition.
export const LOCAL_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "host.docker.internal"] as const;

// How the run says "yes, I mean the live shop". A bare "1" is too easy to
// leave in a shell profile, so the value has to be typed out in full.
export const PRODUCTION_OVERRIDE_ENV = "ORGANZA_ALLOW_PRODUCTION";
export const PRODUCTION_OVERRIDE_VALUE = "I-KNOW-THIS-IS-PRODUCTION";

// Leaves every fixture behind instead of tearing it down — for debugging a
// failure by hand. Never set in a normal run.
export const KEEP_FIXTURES_ENV = "ORGANZA_KEEP_FIXTURES";

// Lets the cash-drawer suite OPEN the drawer for the window that contains
// "now" when the shop has not opened it itself. Off by default and only ever
// appropriate on a disposable database: a drawer is one per calendar day and
// cannot be deleted, so opening today's would take the shop's own day away
// from it. Without it, the one assertion that needs a live window (a cash
// sale reaching the drawer) measures the drawer the shop already opened, or
// reports itself skipped.
export const ALLOW_TODAY_DRAWER_ENV = "ORGANZA_ALLOW_TODAY_DRAWER";

export const TARGET_KINDS = ["sandbox", "local", "production", "unrecognised"] as const;

// Kinds that may be run against with no ceremony. Everything else — the live
// shop, and any host this file has never heard of — is treated as production
// until someone says otherwise. Failing safe on an unknown host is the whole
// point: a typo'd URL must not be assumed harmless.
export const SAFE_TARGET_KINDS = ["sandbox", "local"] as const;
