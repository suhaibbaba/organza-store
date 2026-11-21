import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodIssue, type ZodTypeAny } from "zod";
import { UNKNOWN_FIELD_MESSAGE } from "@/constants";
import type { AnyRecord } from "@/types";

// Validates + coerces req.body in place; failures become an error.validation envelope.
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }

    // Unknown fields are rejected, not silently stripped (zod's default).
    const unknown = unknownFieldPaths(req.body, result.data);
    if (unknown.length > 0) {
      next(unknownFieldError(unknown));
      return;
    }

    req.body = result.data;
    next();
  };
}

// Parsed query goes on req.validatedQuery (req.query can be read-only); no unknown-field check, as proxies append params.
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

/** Plain data objects only; Dates must not count, since z.coerce.date() turns a raw string into one. */
function isPlainObject(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

/** Keys the schema stripped, as dotted paths: present in the raw body, absent from the parsed one. */
function unknownFieldPaths(raw: unknown, parsed: unknown, path: string[] = []): string[][] {
  if (Array.isArray(raw) && Array.isArray(parsed)) {
    return raw.flatMap((entry, index) =>
      index < parsed.length ? unknownFieldPaths(entry, parsed[index], [...path, String(index)]) : [],
    );
  }

  if (!isPlainObject(raw) || !isPlainObject(parsed)) {
    return [];
  }

  const found: string[][] = [];
  for (const key of Object.keys(raw)) {
    if (!(key in parsed)) {
      found.push([...path, key]);
      continue;
    }
    found.push(...unknownFieldPaths(raw[key], parsed[key], [...path, key]));
  }
  return found;
}

/** Shaped as a ZodError so it becomes the usual 400 error.validation with the paths in details. */
function unknownFieldError(paths: string[][]): ZodError {
  const issues = paths.map((path): ZodIssue => ({
    code: "unrecognized_keys",
    keys: [path[path.length - 1]!],
    path: path.slice(0, -1),
    message: UNKNOWN_FIELD_MESSAGE,
  }));
  return new ZodError(issues);
}
