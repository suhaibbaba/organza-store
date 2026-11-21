// The run's target, from API_URL then SANDBOX_API_URL then localhost: a bare run never means the live shop.
import {
  ALLOW_TODAY_DRAWER_ENV,
  DEFAULT_API_URL,
  KEEP_FIXTURES_ENV,
  LOCAL_HOSTS,
  PRODUCTION_API_URL_ENV,
  PRODUCTION_HOST_PREFIXES,
  PRODUCTION_OVERRIDE_ENV,
  PRODUCTION_OVERRIDE_VALUE,
  SAFE_TARGET_KINDS,
  SANDBOX_API_URL_ENV,
  SANDBOX_HOST_PATTERN,
} from "@tests/constants";
import type { ResolvedTarget, TargetKind } from "@tests/types";

function bareHost(host: string): string {
  const lower = host.toLowerCase();
  const prefix = PRODUCTION_HOST_PREFIXES.find((one) => lower.startsWith(one));
  return prefix ? lower.slice(prefix.length) : lower;
}

function productionHost(): string | null {
  const raw = process.env[PRODUCTION_API_URL_ENV]?.trim();
  if (!raw) {
    return null;
  }
  try {
    return bareHost(new URL(raw).hostname);
  } catch {
    return null;
  }
}

const SANDBOX_API_URL = process.env[SANDBOX_API_URL_ENV]?.trim() || DEFAULT_API_URL;

export function classify(host: string, liveHost: string | null = productionHost()): TargetKind {
  const lower = host.toLowerCase();
  if (liveHost && bareHost(lower) === liveHost) {
    return "production";
  }
  if (SANDBOX_HOST_PATTERN.test(lower)) {
    return "sandbox";
  }
  if ((LOCAL_HOSTS as readonly string[]).includes(lower)) {
    return "local";
  }
  // Never heard of it: treated as the live shop, since a typo'd URL must not be assumed harmless.
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
        `Leave it unset to target ${SANDBOX_API_URL_ENV} (${SANDBOX_API_URL}), or set a full origin such as http://localhost:4000.`,
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

/** Today's drawer cannot be deleted, so opening it takes the shop's day; only on a disposable database. */
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
    `  Run it against the sandbox instead (the default — unset API_URL and set ${SANDBOX_API_URL_ENV}):`,
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

// setupFiles run per test file, so the banner is announced once while the gate itself repeats.
let announced = false;

export function assertSafeTarget(target: ResolvedTarget = TARGET): void {
  if (isSafeTarget(target)) {
    if (!announced) {
      console.info(targetBanner(target));
    }
    announced = true;
    return;
  }

  if (!target.overridden) {
    throw new Error(refusalMessage(target));
  }

  if (!announced) {
    console.warn(warningBanner(target));
  }
  announced = true;
}
