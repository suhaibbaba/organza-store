export interface RateLimitOptions {
  /** How many attempts a key gets inside one window. */
  limit: number;
  windowMs: number;
}

export interface RateLimiter {
  /** Records an attempt. False once the window is full. `now` is injectable so expiry is testable. */
  check(key: string, now?: number): boolean;
  /** Forgets every bucket. Used by tests; never by a request path. */
  reset(): void;
}
