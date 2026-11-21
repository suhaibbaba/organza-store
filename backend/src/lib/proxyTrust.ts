import "dotenv/config";
import { DEVELOPMENT_NODE_ENV, PROXY_TRUST_HINT } from "@/constants";

// Who the caller is behind the reverse proxy and Cloudflare: X-Forwarded-For is trusted only from configured proxies.

/** Proxy hops in front of express, or null when nothing is configured. */
export const TRUST_PROXY_SETTING: number | string | null = readTrustProxy();

function readTrustProxy(): number | string | null {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw) {
    return null;
  }
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

/** The proxies' own addresses for Better Auth's chain walk; empty is right on a dev machine. */
export const TRUSTED_PROXY_IPS: string[] = (process.env.TRUSTED_PROXY_IPS ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

/** Both halves must be set: TRUST_PROXY alone leaves Better Auth's sign-in limit on one shared bucket. */
export function isProxyTrustConfigured(): boolean {
  return TRUST_PROXY_SETTING !== null && TRUSTED_PROXY_IPS.length > 0;
}

/** Logs the proxy configuration on every start, since a mistake here is silent until a rate limit counts the wrong thing. */
export function describeProxyTrust(): { level: "info" | "warn"; lines: string[] } {
  const hops = TRUST_PROXY_SETTING === null ? "not set" : String(TRUST_PROXY_SETTING);
  const proxies = TRUSTED_PROXY_IPS.length === 0 ? "not set" : TRUSTED_PROXY_IPS.join(", ");
  const summary = `Proxy trust: TRUST_PROXY=${hops}, TRUSTED_PROXY_IPS=${proxies}`;

  const isDeployedBuild = (process.env.NODE_ENV ?? "").trim() !== DEVELOPMENT_NODE_ENV;

  // A local machine with no proxy is correctly configured and gets one quiet line.
  if (isProxyTrustConfigured() || !isDeployedBuild) {
    return { level: "info", lines: [summary] };
  }

  return { level: "warn", lines: [summary, ...PROXY_TRUST_HINT] };
}
