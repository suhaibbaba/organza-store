// How long the sale-notification suite waits for a push that is sent
// fire-and-forget, after the order's own response has already gone out.
//
// The same figure serves both directions: how long to wait for a
// notification that MUST arrive, and how long to let one that must NOT be
// sent fail to appear. Generous, because it also covers the DNS failure of
// the deliberately unreachable test endpoint on a busy sandbox.
export const PUSH_ATTEMPT_TIMEOUT_MS = 10_000;
export const PUSH_ATTEMPT_POLL_INTERVAL_MS = 300;
