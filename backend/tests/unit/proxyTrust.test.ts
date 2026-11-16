// ============================================================================
//  Proxy trust — who the caller looks like (SECURITY-AUDIT.md H1 / H2)
//
//  A unit test rather than an API one, because the failure it guards has no
//  observable symptom over HTTP: a misconfigured deployment answers every
//  request perfectly, and only the rate limiting is wrong — silently, until
//  the morning one attacker has locked the whole shop out of the till.
//
//  lib/proxyTrust.ts reads its environment once at module load (both values
//  are decided at startup and baked into express and Better Auth), so each
//  case resets the module registry and re-imports it under a different
//  environment.
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEYS = ["TRUST_PROXY", "TRUSTED_PROXY_IPS", "NODE_ENV"] as const;

async function loadWith(env: Partial<Record<(typeof KEYS)[number], string | undefined>>) {
  for (const key of KEYS) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  vi.resetModules();
  return import("@/lib/proxyTrust");
}

describe("proxy trust", () => {
  const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    vi.resetModules();
  });

  describe("TRUST_PROXY, the hop count express is given", () => {
    it("is null when unset, so express is never told to trust a header nobody wrote", async () => {
      const { TRUST_PROXY_SETTING, isProxyTrustConfigured } = await loadWith({
        TRUST_PROXY: undefined,
        TRUSTED_PROXY_IPS: undefined,
        NODE_ENV: "development",
      });

      expect(TRUST_PROXY_SETTING).toBeNull();
      expect(isProxyTrustConfigured()).toBe(false);
    });

    it("becomes a NUMBER when it is digits, not the string '2'", async () => {
      // express treats `"2"` and `2` differently: a string is read as a list
      // of trusted addresses, so the quoted version would trust a proxy
      // literally named "2" and nothing else.
      const { TRUST_PROXY_SETTING } = await loadWith({ TRUST_PROXY: "2", NODE_ENV: "development" });

      expect(TRUST_PROXY_SETTING).toBe(2);
      expect(typeof TRUST_PROXY_SETTING).toBe("number");
    });

    it("passes a non-numeric value through as express's own syntax", async () => {
      const { TRUST_PROXY_SETTING } = await loadWith({ TRUST_PROXY: "loopback", NODE_ENV: "development" });
      expect(TRUST_PROXY_SETTING).toBe("loopback");
    });

    it("treats whitespace as unset rather than as a value", async () => {
      const { TRUST_PROXY_SETTING } = await loadWith({ TRUST_PROXY: "   ", NODE_ENV: "development" });
      expect(TRUST_PROXY_SETTING).toBeNull();
    });
  });

  describe("TRUSTED_PROXY_IPS, the addresses Better Auth strips", () => {
    it("splits, trims and drops the empties a hand-edited env file leaves behind", async () => {
      const { TRUSTED_PROXY_IPS } = await loadWith({
        TRUSTED_PROXY_IPS: " 172.18.0.1 , 173.245.48.0/20 ,, ",
        NODE_ENV: "development",
      });

      expect(TRUSTED_PROXY_IPS).toEqual(["172.18.0.1", "173.245.48.0/20"]);
    });

    it("is empty when unset, which is correct locally and wrong on a deployment", async () => {
      const { TRUSTED_PROXY_IPS } = await loadWith({ TRUSTED_PROXY_IPS: undefined, NODE_ENV: "development" });
      expect(TRUSTED_PROXY_IPS).toEqual([]);
    });
  });

  describe("what it says on startup", () => {
    it("shouts when a DEPLOYED build has been told nothing", async () => {
      // The whole point of the check: this is the state the live shop was in,
      // and nothing anywhere said so.
      const { describeProxyTrust } = await loadWith({
        TRUST_PROXY: undefined,
        TRUSTED_PROXY_IPS: undefined,
        NODE_ENV: "production",
      });

      const described = describeProxyTrust();
      expect(described.level).toBe("warn");
      // The message has to be actionable at 2am in a deploy log, so it names
      // both variables and the hop count for the current chain.
      const text = described.lines.join("\n");
      expect(text).toContain("TRUST_PROXY=2");
      expect(text).toContain("TRUSTED_PROXY_IPS");
    });

    it("stays quiet on a developer's machine, where nothing in front IS the truth", async () => {
      const { describeProxyTrust } = await loadWith({
        TRUST_PROXY: undefined,
        TRUSTED_PROXY_IPS: undefined,
        NODE_ENV: "development",
      });

      expect(describeProxyTrust().level).toBe("info");
    });

    it("stays quiet on a deployment that has been configured, and reports what it read", async () => {
      const { describeProxyTrust } = await loadWith({
        TRUST_PROXY: "2",
        TRUSTED_PROXY_IPS: "172.18.0.1",
        NODE_ENV: "production",
      });

      const described = describeProxyTrust();
      expect(described.level).toBe("info");
      expect(described.lines.join("\n")).toContain("TRUST_PROXY=2");
      expect(described.lines.join("\n")).toContain("172.18.0.1");
    });

    it("still shouts when only ONE of the two is set — half-configured is the trap", async () => {
      // Setting TRUST_PROXY alone fixes express and leaves Better Auth's
      // sign-in limit sharing one bucket with the entire internet, which is
      // the more dangerous half AND the half that looks fixed. Neither value
      // on its own counts as done.
      for (const half of [{ TRUST_PROXY: "2" }, { TRUSTED_PROXY_IPS: "172.18.0.1" }]) {
        const { describeProxyTrust, isProxyTrustConfigured } = await loadWith({
          TRUST_PROXY: undefined,
          TRUSTED_PROXY_IPS: undefined,
          NODE_ENV: "production",
          ...half,
        });

        expect(isProxyTrustConfigured()).toBe(false);
        expect(describeProxyTrust().level).toBe("warn");
      }
    });
  });
});
