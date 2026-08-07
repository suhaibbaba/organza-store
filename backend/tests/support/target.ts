// Where this run is pointed, and whether it is allowed to go there.
//
// Resolved once, at module load, from API_URL — defaulting to the sandbox so
// that a bare `vitest` can never accidentally mean "the live shop". The guard
// below is what every entry point (tests/setup.ts and scripts/verify.ts)
// calls before the first request goes out.
import {
  ALLOW_TODAY_DRAWER_ENV,
  KEEP_FIXTURES_ENV,
  LOCAL_HOSTS,
  PRODUCTION_HOSTS,
  PRODUCTION_OVERRIDE_ENV,
  PRODUCTION_OVERRIDE_VALUE,
  SAFE_TARGET_KINDS,
  SANDBOX_API_URL,
  SANDBOX_HOST_PATTERN,
} from "@tests/constants";
import type { ResolvedTarget, TargetKind } from "@tests/types";

function classify(host: string): TargetKind {
  const lower = host.toLowerCase();
  if ((PRODUCTION_HOSTS as readonly string[]).includes(lower)) return "production";
  if (SANDBOX_HOST_PATTERN.test(lower)) return "sandbox";
  if ((LOCAL_HOSTS as readonly string[]).includes(lower)) return "local";
  // Never heard of it. Treated as the live shop until someone says otherwise
  // — a typo'd URL must not be assumed harmless.
  return "unrecognised";
}

function resolve(): ResolvedTarget {
  const raw = process.env.API_URL?.trim();
  const explicit = Boolean(raw);
  const url = (raw || SANDBOX_API_URL).replace(/\/+$/, "");

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(
      `API_URL is not a valid URL: ${JSON.stringify(raw)}.\n` +
        `Leave it unset to target the sandbox (${SANDBOX_API_URL}), or set a full origin such as http://localhost:4000.`
    );
  }

  return {
    url,
    host,
    kind: classify(host),
    explicit,
    overridden: process.env[PRODUCTION_OVERRIDE_ENV] === PRODUCTION_OVERRIDE_VALUE,
  };
}

export const TARGET: ResolvedTarget = resolve();

export function isSafeTarget(target: ResolvedTarget = TARGET): boolean {
  return (SAFE_TARGET_KINDS as readonly string[]).includes(target.kind);
}

/** Fixtures are torn down unless a run explicitly asks to keep them for inspection. */
export function keepFixtures(): boolean {
  return process.env[KEEP_FIXTURES_ENV] === "1" || process.env[KEEP_FIXTURES_ENV] === "true";
}

/**
 * May this run OPEN the drawer for the window that contains "now"?
 *
 * A drawer is one per calendar day and there is no way to delete one, so
 * opening today's takes the shop's own day away from it. Off unless the run
 * says the database is disposable.
 */
export function mayOpenTodaysDrawer(): boolean {
  return process.env[ALLOW_TODAY_DRAWER_ENV] === "1" || process.env[ALLOW_TODAY_DRAWER_ENV] === "true";
}

const RULE = "═".repeat(74);

function refusalMessage(target: ResolvedTarget): string {
  const what =
    target.kind === "production"
      ? "the LIVE SHOP's API"
      : "an API this suite does not recognise (so it is treated as the live shop)";

  return [
    "",
    RULE,
    "  ⛔  REFUSING TO RUN",
    RULE,
    `  Target : ${target.url}`,
    `  Host   : ${target.host}  →  ${target.kind}`,
    "",
    `  That is ${what}.`,
    "",
    "  This suite is not read-only. It creates orders, moves stock, records",
    "  expenses and opens cash drawers. Against real data that is a stranger",
    "  ringing up sales on the shop's till.",
    "",
    "  Run it against the sandbox instead (the default — just unset API_URL):",
    `      ${SANDBOX_API_URL}`,
    "",
    "  If you genuinely mean the live shop, say so in full:",
    `      ${PRODUCTION_OVERRIDE_ENV}=${PRODUCTION_OVERRIDE_VALUE} npm run verify`,
    RULE,
    "",
  ].join("\n");
}

function warningBanner(target: ResolvedTarget): string {
  return [
    "",
    RULE,
    "  ⚠️   RUNNING AGAINST PRODUCTION DATA  ⚠️",
    RULE,
    `  Target : ${target.url}`,
    `  Host   : ${target.host}  →  ${target.kind}`,
    "",
    `  ${PRODUCTION_OVERRIDE_ENV} is set, so the safety refusal has been waived.`,
    "",
    "  This run WILL create orders, move stock and record expenses against",
    "  the shop's real database. Fixtures are torn down at the end, but a",
    "  cash-drawer session cannot be deleted once opened, and audit entries",
    "  are permanent by design.",
    "",
    "  Press Ctrl-C now if this was not deliberate.",
    RULE,
    "",
  ].join("\n");
}

export function targetBanner(target: ResolvedTarget = TARGET): string {
  const source = target.explicit ? "API_URL" : "default";
  return `🎯  Target: ${target.url}  (${target.kind}, from ${source})`;
}

/**
 * The gate. Sandbox and local run without ceremony; the live shop — and any
 * host this file has never heard of — is refused unless the override says
 * otherwise, and even then it shouts first.
 *
 * Throws rather than exiting, so vitest reports it as a failure rather than
 * as a silent zero-test run.
 */
// setupFiles run once per TEST FILE, so without this the banner (or the
// production warning) would be printed thirty times in a row and stop being
// read. The check itself is cheap and repeats; only the announcement doesn't.
let announced = false;

export function assertSafeTarget(target: ResolvedTarget = TARGET): void {
  if (isSafeTarget(target)) {
    if (!announced) console.info(targetBanner(target));
    announced = true;
    return;
  }

  if (!target.overridden) throw new Error(refusalMessage(target));

  if (!announced) console.warn(warningBanner(target));
  announced = true;
}
