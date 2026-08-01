import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

// Validates + coerces req.body in place. Parse failures are forwarded to the
// central error handler as a ZodError -> error.validation envelope.
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}

// req.query is read-only in some Express/Node combinations, so the parsed,
// coerced query is stashed on req.validatedQuery rather than reassigned.
export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.validatedQuery = result.data;
    next();
  };
}
