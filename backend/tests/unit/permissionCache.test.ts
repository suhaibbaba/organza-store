// The cache behind `can()`, tested for what it actually promises.
//
// Not a database test: what matters here is the STALENESS LOGIC — that a
// request inside the freshness window costs nothing, that a version which has
// moved causes exactly one re-read, that one which has not causes none, and
// that a change made in this process is visible immediately. Handing the
// clock and the two loaders in is what makes those four assertable in
// milliseconds instead of by waiting five seconds and hoping.
import { afterEach, describe, expect, it } from "vitest";
import { PermissionCache } from "@/lib/permissionConfig";
import { can, setConfigurablePermissions } from "@organza/shared/lib/permissions";
import type { ConfigurablePermissionMatrix } from "@organza/shared/types/permission";

// `can()` reads module-level state in the shared package, and this file is in
// the same process as every other suite (vitest.config.ts: isolate false,
// singleFork). So whatever a case here publishes is taken back afterwards.
afterEach(() => {
  setConfigurablePermissions(null);
});

interface Harness {
  cache: PermissionCache;
  advance: (ms: number) => void;
  setVersion: (version: string) => void;
  setMatrix: (matrix: ConfigurablePermissionMatrix) => void;
  counts: { version: number; matrix: number };
  errors: unknown[];
}

function harness(options: { ttlMs?: number; failWith?: () => Error | null } = {}): Harness {
  let clock = 1_000;
  let version = "v1";
  let matrix: ConfigurablePermissionMatrix = { EMPLOYEE: { "product.create": true } };
  const counts = { version: 0, matrix: 0 };
  const errors: unknown[] = [];
  const fail = options.failWith ?? (() => null);

  const cache = new PermissionCache({
    ttlMs: options.ttlMs ?? 5_000,
    now: () => clock,
    onError: (error) => errors.push(error),
    loadVersion: async () => {
      const error = fail();
      if (error) throw error;
      counts.version++;
      return version;
    },
    loadMatrix: async () => {
      const error = fail();
      if (error) throw error;
      counts.matrix++;
      return matrix;
    },
  });

  return {
    cache,
    counts,
    errors,
    advance: (ms) => {
      clock += ms;
    },
    setVersion: (next) => {
      version = next;
    },
    setMatrix: (next) => {
      matrix = next;
    },
  };
}

describe("PermissionCache", () => {
  it("reads the table once on the first call and publishes it to can()", async () => {
    const h = harness();
    await h.cache.ensureFresh();

    expect(h.counts.matrix).toBe(1);
    expect(h.cache.isLoaded).toBe(true);
    expect(can({ role: "EMPLOYEE" }, "product.create")).toBe(true);
  });

  it("costs nothing at all inside the freshness window", async () => {
    const h = harness({ ttlMs: 5_000 });
    await h.cache.ensureFresh();
    const afterFirst = { ...h.counts };

    h.advance(4_999);
    for (let i = 0; i < 50; i++) await h.cache.ensureFresh();

    expect(h.counts).toEqual(afterFirst);
  });

  it("asks for the version once the window is up, and re-reads nothing when it has not moved", async () => {
    const h = harness({ ttlMs: 5_000 });
    await h.cache.ensureFresh();
    const matrixReads = h.counts.matrix;

    h.advance(5_001);
    await h.cache.ensureFresh();

    expect(h.counts.version, "the version was asked for").toBeGreaterThan(1);
    expect(h.counts.matrix, "but the table was not re-read").toBe(matrixReads);
  });

  it("re-reads the table exactly once when the version has moved — another process's change", async () => {
    const h = harness({ ttlMs: 5_000 });
    await h.cache.ensureFresh();
    expect(can({ role: "EMPLOYEE" }, "product.create")).toBe(true);

    // Somebody unticked the box on a different container.
    h.setMatrix({ EMPLOYEE: { "product.create": false } });
    h.setVersion("v2");

    // Inside the window, this process is still on the old answer — which is
    // the honest description of the design, not a bug: it is bounded by
    // PERMISSION_CACHE_TTL_MS and the process that made the change is
    // already correct.
    h.advance(1_000);
    await h.cache.ensureFresh();
    expect(can({ role: "EMPLOYEE" }, "product.create")).toBe(true);

    // Once the window is up it catches up, in one read.
    h.advance(5_001);
    const before = h.counts.matrix;
    await h.cache.ensureFresh();
    expect(h.counts.matrix).toBe(before + 1);
    expect(can({ role: "EMPLOYEE" }, "product.create")).toBe(false);

    // ...and does not keep re-reading afterwards.
    h.advance(5_001);
    await h.cache.ensureFresh();
    expect(h.counts.matrix).toBe(before + 1);
  });

  it("takes effect immediately in the process that made the change", async () => {
    const h = harness({ ttlMs: 60_000 });
    await h.cache.ensureFresh();
    expect(can({ role: "EMPLOYEE" }, "product.create")).toBe(true);

    h.setMatrix({ EMPLOYEE: { "product.create": false } });
    h.setVersion("v2");

    // No clock movement at all: this is the write path, and it must not wait
    // for a window it is itself inside.
    await h.cache.invalidate();
    expect(can({ role: "EMPLOYEE" }, "product.create")).toBe(false);
  });

  it("collapses a burst of concurrent requests into one read", async () => {
    const h = harness();
    await Promise.all(Array.from({ length: 20 }, () => h.cache.ensureFresh()));
    expect(h.counts.matrix).toBe(1);
  });

  it("keeps the last good rules when the database cannot be reached", async () => {
    let broken = false;
    const h = harness({ ttlMs: 5_000, failWith: () => (broken ? new Error("connection refused") : null) });

    await h.cache.ensureFresh();
    expect(can({ role: "EMPLOYEE" }, "product.create")).toBe(true);

    broken = true;
    h.advance(5_001);
    await h.cache.ensureFresh();

    expect(h.errors.length, "the failure is reported").toBeGreaterThan(0);
    expect(can({ role: "EMPLOYEE" }, "product.create"), "and the shop keeps working").toBe(true);
  });

  it("does not ask a database that is down once per request", async () => {
    let broken = true;
    const h = harness({ ttlMs: 5_000, failWith: () => (broken ? new Error("connection refused") : null) });

    // Nothing has ever loaded, so there is no cached answer to serve — and
    // that is exactly when a naive retry-every-time keeps a struggling
    // database company. One attempt per window, no more.
    await h.cache.ensureFresh();
    const attempts = h.errors.length;

    h.advance(1_000);
    for (let i = 0; i < 25; i++) await h.cache.ensureFresh();
    expect(h.errors.length).toBe(attempts);

    // ...and it does try again once the window is up, rather than giving up.
    h.advance(5_001);
    broken = false;
    await h.cache.ensureFresh();
    expect(h.cache.isLoaded).toBe(true);
  });

  it("falls back to the shipped defaults before anything has been loaded", () => {
    // Nothing published: `can()` answers from DEFAULT_ROLE_PERMISSIONS, so a
    // process that has just started is running the rules as written rather
    // than refusing everything or allowing everything.
    setConfigurablePermissions(null);
    expect(can({ role: "EMPLOYEE" }, "product.create")).toBe(true);
    expect(can({ role: "EMPLOYEE" }, "inventory.adjust")).toBe(false);
  });
});
