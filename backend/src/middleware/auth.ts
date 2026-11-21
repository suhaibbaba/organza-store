import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { Role } from "@prisma/client";
import { can } from "@organza/shared/lib/permissions";
import type { PermissionAction } from "@organza/shared/types/permission";
import { auth } from "@/lib/auth";
import { ensurePermissionConfigFresh } from "@/lib/permissionConfig";
import { AppError } from "@/lib/response";
import { ERROR_CODES } from "@/constants";

// Establishes who is calling (cookie or bearer); permission checks are requirePermission's job.
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
    req.sessionId = session.session.id;

    // The once-per-request freshness check for stored permissions; never throws, so a database blip keeps the last good rules.
    await ensurePermissionConfigFresh();
    next();
  } catch (err) {
    next(err instanceof AppError ? err : new AppError(401, ERROR_CODES.UNAUTHORIZED));
  }
}

// Backend-enforced permission gate (rule 5); must run after requireAuth.
export function requirePermission(action: PermissionAction) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !can(req.user, action)) {
      next(new AppError(403, ERROR_CODES.FORBIDDEN));
      return;
    }
    next();
  };
}
