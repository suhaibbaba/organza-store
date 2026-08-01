import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { Role } from "@prisma/client";
import { auth } from "../lib/auth";
import { AppError } from "../lib/response";

export interface AuthedUser {
  id: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

// Resolves the Better Auth session (cookie or bearer token) and attaches the
// caller's id/role to the request. Role checks themselves happen in
// requireRole — this only establishes "who is this".
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user) {
      throw new AppError(401, "error.unauthorized");
    }
    const user = session.user as typeof session.user & { role: Role; isActive: boolean };
    if (!user.isActive) {
      throw new AppError(403, "error.account.inactive");
    }
    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    next(err instanceof AppError ? err : new AppError(401, "error.unauthorized"));
  }
}

// Backend-enforced role gate (CLAUDE.md rule 5) — never rely on the UI
// hiding a button. Must run after requireAuth.
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError(403, "error.forbidden"));
      return;
    }
    next();
  };
}
