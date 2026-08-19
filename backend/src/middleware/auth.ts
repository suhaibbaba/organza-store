import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { Role } from "@prisma/client";
import { can } from "@organza/shared/lib/permissions";
import type { PermissionAction } from "@organza/shared/types/permission";
import { auth } from "@/lib/auth";
import { ensurePermissionConfigFresh } from "@/lib/permissionConfig";
import { AppError } from "@/lib/response";
import { ERROR_CODES } from "@/constants";

// Resolves the Better Auth session (cookie or bearer token) and attaches the
// caller's id/role to the request. Permission checks themselves happen in
// requirePermission — this only establishes "who is this".
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user) {
      throw new AppError(401, ERROR_CODES.UNAUTHORIZED);
    }
    const user = session.user as typeof session.user & { role: Role; isActive: boolean };
    if (!user.isActive) {
      throw new AppError(403, ERROR_CODES.ACCOUNT_INACTIVE);
    }
    req.user = { id: user.id, role: user.role };

    // The one place per request where the stored half of the permission rules
    // is checked for freshness — never inside `can()`, which is synchronous
    // and called dozens of times further down every request
    // (lib/permissionConfig.ts). Inside the freshness window this is a no-op;
    // outside it, it is a single digest query, next to the session lookup
    // this function has just awaited anyway. It never throws: an unreachable
    // database leaves the last good rules in force rather than locking the
    // shop out of its own till.
    await ensurePermissionConfigFresh();
    next();
  } catch (err) {
    next(err instanceof AppError ? err : new AppError(401, ERROR_CODES.UNAUTHORIZED));
  }
}

// Backend-enforced permission gate (CLAUDE.md rule 5) — never rely on the UI
// hiding a button. The role->action rules live in @organza/shared/ (`can`), this is
// just the Express wiring around it. Must run after requireAuth.
export function requirePermission(action: PermissionAction) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !can(req.user, action)) {
      next(new AppError(403, ERROR_CODES.FORBIDDEN));
      return;
    }
    next();
  };
}
