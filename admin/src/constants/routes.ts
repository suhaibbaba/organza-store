/**
 * Where somebody goes when nobody knows their role yet.
 *
 * Three places need this answer and none of them can ask: the root path and
 * the proxy both run before the session has been read at all, and the login
 * form's own fallback covers an account that may open nothing. Written once,
 * here, because the last time it was written three times one of the copies
 * outlived the day the dashboard stopped being visible to everyone.
 *
 * The dashboard, still: it is the right screen for the two roles that hold it,
 * and RoleGuard forwards anybody else to their own first screen (Orders, for
 * an Employee) rather than refusing them. A signed-in caller should not use
 * this at all — `landingHref` in lib/nav.ts knows the role and answers
 * exactly, and routing an Employee through a screen they may not open, even
 * for one frame, is a flash of nothing first thing in the morning.
 *
 * This file imports NOTHING on purpose. proxy.ts runs in the proxy runtime,
 * and lib/nav.ts — the obvious other home for it — reaches the whole nav
 * table and, through it, an icon library that has no business being bundled
 * there.
 */
export const DEFAULT_LANDING_HREF = "/dashboard";
