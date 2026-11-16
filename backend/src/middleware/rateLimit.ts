import type { NextFunction, Request, Response } from "express";
import { AppError } from "@/lib/response";
import { ERROR_CODES, RATE_LIMIT_SWEEP_INTERVAL_MS } from "@/constants";
import type { RateLimitOptions, RateLimiter } from "@/types/rateLimit";

// A fixed-window rate limiter, in memory.
//
// In memory is the right size for this shop: one API container, on one VPS,
// in front of a handful of staff. The alternative (Redis) would be a second
// service to run and back up for the sake of endpoints that see a few
// requests a day. If the API is ever run as more than one process, this
// becomes per-process — which weakens the limit rather than breaking it, and
// is the point at which to move the counters into Postgres.
//
// It exists for the public password endpoints, which are the only doors into
// the system that take no session: without it, "email me a link" is a mail
// cannon pointed at any address somebody types.

export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = 0;

  function sweep(now: number): void {
    if (now - lastSweep < RATE_LIMIT_SWEEP_INTERVAL_MS) return;
    lastSweep = now;
    for (const [key, bucket] of hits) {
      if (bucket.resetAt <= now) hits.delete(key);
    }
  }

  return {
    /** Records one attempt against `key`. Returns false once the window is full. */
    check(key: string, now = Date.now()): boolean {
      sweep(now);
      const bucket = hits.get(key);
      if (!bucket || bucket.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + options.windowMs });
        return true;
      }
      if (bucket.count >= options.limit) return false;
      bucket.count += 1;
      return true;
    },

    reset(): void {
      hits.clear();
      lastSweep = 0;
    },
  };
}

/**
 * Express wiring. `keyOf` decides what is being limited — the caller's
 * address, the email they typed, or both in sequence.
 *
 * Answers 429 with `error.rate_limited` and nothing else: a limiter that
 * explains which of its rules was hit is a limiter that helps whoever is
 * probing it.
 */
export function rateLimit(limiter: RateLimiter, keyOf: (req: Request) => string | null) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = keyOf(req);
    if (key === null) {
      next();
      return;
    }
    if (!limiter.check(key)) {
      next(new AppError(429, ERROR_CODES.RATE_LIMITED));
      return;
    }
    next();
  };
}

/** The caller, as well as express can tell. Behind the VPS's reverse proxy this is the proxy unless `trust proxy` is on. */
export function callerKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}
