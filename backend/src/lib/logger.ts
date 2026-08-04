import "dotenv/config";
import * as Sentry from "@sentry/node";

// Isolated error-tracking layer (CLAUDE.md rule 20). Nothing outside this
// file imports @sentry/node, so swapping Sentry for a self-hosted,
// Sentry-compatible GlitchTip is a change of DSN — and swapping it for
// something else entirely is a change of this file.
//
// This is NOT the audit log: the audit log is a business record the shop
// reads in the admin, this is technical breakage the shop should never have
// to see. Everything captured here also goes to the console, so a deployment
// with no DSN configured still leaves a trace in `docker compose logs`.

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    // Errors only. Performance tracing would sample every request on a VPS
    // that is also serving the shop.
    tracesSampleRate: 0,
  });
}

/** Whether a tracker is actually wired up — useful in health/debug output. */
export const isErrorTrackingEnabled = Boolean(dsn);

/**
 * Report a technical failure. Never throws: a logger that can bring down the
 * path it is reporting on is worse than no logger, and every caller here is
 * already on an error path.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  try {
    if (dsn) {
      Sentry.captureException(error, context ? { extra: context } : undefined);
    }
    console.error(error, context ?? "");
  } catch {
    // Reporting the failure failed. There is nowhere left to say so.
  }
}
