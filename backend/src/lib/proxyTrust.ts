import "dotenv/config";
import { DEVELOPMENT_NODE_ENV, PROXY_TRUST_HINT } from "@/constants";

/*
 * WHO THE CALLER IS, when somebody else's machine is doing the talking.
 *
 * Behind the VPS's reverse proxy — and now behind Cloudflare in front of that
 * — every request arrives from the same address. The real caller is only
 * knowable from `X-Forwarded-For`, and that header is written by whoever is
 * upstream, which includes the caller themselves. So it is either trusted
 * carefully or not at all; trusted carelessly it lets any caller claim any
 * address, and trusted not at all it makes every caller look like one person.
 *
 * That second failure is the one this shop actually had, and it is not the
 * harmless half. Every per-caller rate limit in the system — the password
 * endpoints here, and Better Auth's sign-in limit (see lib/auth.ts) — counts
 * against a key derived from the caller. If every caller resolves to the same
 * key, the limit stops protecting the shop from an attacker and starts
 * protecting the attacker from the shop: one machine spending the budget
 * locks out everybody, from every network, for as long as it keeps going.
 *
 * Two settings, because the two consumers parse the chain differently:
 *
 *   TRUST_PROXY        a HOP COUNT, for express. `req.ip` becomes the address
 *                      that many hops back from the socket.
 *   TRUSTED_PROXY_IPS  the proxies' own ADDRESSES (IPs or CIDRs), for Better
 *                      Auth, which strips them from the right of the chain.
 *
 * Both describe the same deployment and both have to be set, which is exactly
 * why this file exists rather than two lookups in two places: so that
 * `describeProxyTrust()` can say, out loud on every start, what this process
 * actually believes — and say so loudly when it believes nothing.
 */

/** Proxy hops in front of express, or null when nothing is configured. */
export const TRUST_PROXY_SETTING: number | string | null = readTrustProxy();

function readTrustProxy(): number | string | null {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw) return null;
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

/**
 * The proxies' own addresses, for Better Auth's chain walk.
 *
 * Empty is a valid answer — it is the right one on a developer's machine,
 * where nothing sits in front of the app and a single-entry `X-Forwarded-For`
 * is the only thing Better Auth will trust anyway.
 */
export const TRUSTED_PROXY_IPS: string[] = (process.env.TRUSTED_PROXY_IPS ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

/**
 * Are BOTH halves configured?
 *
 * Both, not either, and this is the sharp edge of the whole file. Setting
 * TRUST_PROXY alone fixes express — `req.ip` becomes the caller, the password
 * endpoints start counting properly — and leaves Better Auth's sign-in limit
 * exactly as broken as it was, sharing one bucket with the entire internet.
 * That half is the more dangerous one, and it is the half that looks fixed:
 * somebody who set the variable the documentation used to mention would have
 * every reason to believe they were done.
 *
 * So a deployment with one of the two is reported as misconfigured, not as
 * half-done.
 */
export function isProxyTrustConfigured(): boolean {
  return TRUST_PROXY_SETTING !== null && TRUSTED_PROXY_IPS.length > 0;
}

/**
 * One line for the deploy log, and — when it matters — a paragraph.
 *
 * A misconfiguration here is silent by construction: nothing errors, no
 * request fails, and the only symptom is a rate limit that counts the wrong
 * thing, which nobody notices until the morning somebody cannot sign in. So
 * the process says what it thinks on every start, next to the uploads path,
 * for the same reason: it is the one question you cannot answer from the
 * outside.
 *
 * `level: "warn"` is reserved for a case that is always wrong: a process
 * running a deployed build (`NODE_ENV` is not "development") with nothing
 * configured at all. Every deployment of this API has a proxy in front of it
 * — the TLS is terminated there — so "nothing in front of me" and "I am
 * deployed" cannot both be true.
 *
 * Note which environment variable that check reads. APP_ENV distinguishes the
 * sandbox stack from the live shop, and a developer's machine calls itself
 * "sandbox" too (backend/.env.example), so it cannot tell a laptop from a
 * VPS. NODE_ENV can: it is the one that says "this is a built process", which
 * is the actual question.
 */
export function describeProxyTrust(): { level: "info" | "warn"; lines: string[] } {
  const hops = TRUST_PROXY_SETTING === null ? "not set" : String(TRUST_PROXY_SETTING);
  const proxies = TRUSTED_PROXY_IPS.length === 0 ? "not set" : TRUSTED_PROXY_IPS.join(", ");
  const summary = `Proxy trust: TRUST_PROXY=${hops}, TRUSTED_PROXY_IPS=${proxies}`;

  const isDeployedBuild = (process.env.NODE_ENV ?? "").trim() !== DEVELOPMENT_NODE_ENV;

  // A local machine with nothing in front of it is correctly configured by
  // saying nothing, so it gets one quiet line like any other startup fact.
  if (isProxyTrustConfigured() || !isDeployedBuild) {
    return { level: "info", lines: [summary] };
  }

  return { level: "warn", lines: [summary, ...PROXY_TRUST_HINT] };
}
