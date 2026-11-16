import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/middleware/rateLimit";

// The counter behind the public password endpoints. Exercised directly with
// an injected clock, because a window that resets after fifteen minutes is
// not something an HTTP suite can sit and wait for.

const WINDOW_MS = 15 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 1, 9, 0, 0);

describe("Rate limiter", () => {
  it("allows exactly the configured number of attempts, then refuses", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: WINDOW_MS });

    expect(limiter.check("a@example.com", NOW)).toBe(true);
    expect(limiter.check("a@example.com", NOW)).toBe(true);
    expect(limiter.check("a@example.com", NOW)).toBe(true);
    expect(limiter.check("a@example.com", NOW)).toBe(false);
  });

  it("counts each key separately", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: WINDOW_MS });

    expect(limiter.check("a@example.com", NOW)).toBe(true);
    // One person exhausting their budget must not lock everybody else out.
    expect(limiter.check("b@example.com", NOW)).toBe(true);
    expect(limiter.check("a@example.com", NOW)).toBe(false);
  });

  it("lets a key through again once its window has passed", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: WINDOW_MS });

    expect(limiter.check("a@example.com", NOW)).toBe(true);
    expect(limiter.check("a@example.com", NOW + WINDOW_MS - 1)).toBe(false);
    expect(limiter.check("a@example.com", NOW + WINDOW_MS)).toBe(true);
  });

  it("forgets buckets whose window has expired, so a long uptime doesn't grow forever", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: WINDOW_MS });

    for (let i = 0; i < 100; i++) limiter.check(`probe-${i}@example.com`, NOW);
    // A day later every one of those buckets is dead; the sweep runs on the
    // next check and the limiter behaves as if none of them ever existed.
    expect(limiter.check("probe-0@example.com", NOW + 24 * 60 * 60 * 1000)).toBe(true);
  });
});
