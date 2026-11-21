import type { NextFunction, Request, Response } from "express";
import { AppError } from "@/lib/response";
import { ERROR_CODES, RATE_LIMIT_SWEEP_INTERVAL_MS } from "@/constants";
import type { RateLimitOptions, RateLimiter } from "@/types/rateLimit";

// Fixed-window in-memory limiter — right for one API container; more processes would weaken it per process.

export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = 0;

  function sweep(now: number): void {
    if (now - lastSweep < RATE_LIMIT_SWEEP_INTERVAL_MS) {
      return;
    }
    lastSweep = now;
    for (const [key, bucket] of hits) {
      if (bucket.resetAt <= now) {
        hits.delete(key);
      }
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
      if (bucket.count >= options.limit) {
        return false;
      }
      bucket.count += 1;
      return true;
    },

    reset(): void {
      hits.clear();
      lastSweep = 0;
    },
  };
}

/** `keyOf` picks what is limited; answers 429 error.rate_limited and nothing more, so probing learns nothing. */
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
