import type { AuthedUser } from "./user";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // Set by requireAuth once the Better Auth session is resolved.
      user?: AuthedUser;
      // Parsed+coerced req.query, stashed here since req.query is read-only
      // in some Express/Node combinations.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validatedQuery?: any;
    }
  }
}
