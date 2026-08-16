import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodIssue, type ZodTypeAny } from "zod";
import { UNKNOWN_FIELD_MESSAGE } from "@/constants";
import type { AnyRecord } from "@/types";

// Validates + coerces req.body in place. Parse failures are forwarded to the
// central error handler as a ZodError -> error.validation envelope.
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }

    // A field this endpoint has never heard of is a rejection, not a shrug.
    //
    // Zod's default is `.strip()`: an unknown key is silently discarded, and
    // the request succeeds as though it had never been sent. That is not
    // currently exploitable here — every route reads the PARSED body, nothing
    // spreads `req.body` into a Prisma `data:`, and none of `role`,
    // `approvalStatus`, `stockDeductedAt`, `collectedAt` or any price appears
    // in any schema — but the whole defence rests on nobody ever writing
    // `data: { ...body }`, which is one plausible refactor away from being a
    // mass-assignment hole. It also means a client typo (`discountVal` for
    // `discountValue`) is answered with a 200 and quietly does nothing, which
    // is the worst way to be told.
    //
    // Done here rather than by adding `.strict()` to each of the thirty-odd
    // schemas, for two reasons. It cannot be forgotten on the next schema
    // somebody writes. And `.strict()` has to be applied to a ZodObject
    // BEFORE `.refine()` wraps it, which most of these schemas do — so the
    // per-schema version would be both a large diff and an easy one to get
    // subtly wrong.
    const unknown = unknownFieldPaths(req.body, result.data);
    if (unknown.length > 0) {
      next(unknownFieldError(unknown));
      return;
    }

    req.body = result.data;
    next();
  };
}

// req.query is read-only in some Express/Node combinations, so the parsed,
// coerced query is stashed on req.validatedQuery rather than reassigned.
//
// Deliberately NOT given the unknown-field check above. A query string is
// appended to by things that are not the client's code — cache-busters, link
// trackers, an `?_=1699…` from a proxy — and none of them is an attempt to
// set anything: a query parameter cannot reach a write, because every write
// on this API reads its values from the body. Refusing them would break real
// requests to prevent nothing.
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

/**
 * Plain data objects only — the things a JSON body is built out of.
 *
 * Dates in particular must NOT count: `z.coerce.date()` turns a string into a
 * Date, so the parsed side is an object where the raw side was a string, and
 * descending into one would compare a Date's internals against nothing.
 */
function isPlainObject(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

/**
 * Which keys the schema threw away, as dotted paths.
 *
 * Works by comparing what was sent against what came back, which is what
 * makes it schema-shape-agnostic: Zod strips unknown keys, so a key present
 * in the raw body and absent from the parsed one is by definition a key this
 * endpoint does not accept. That holds for a plain object, for one wrapped in
 * `.refine()`, and for whatever the next schema turns out to be — none of
 * which a `.strict()` call could be attached to uniformly.
 *
 * Recurses through nested objects and arrays so `items[0].unitPrice` is
 * caught as surely as a top-level one.
 */
function unknownFieldPaths(raw: unknown, parsed: unknown, path: string[] = []): string[][] {
  if (Array.isArray(raw) && Array.isArray(parsed)) {
    return raw.flatMap((entry, index) =>
      index < parsed.length ? unknownFieldPaths(entry, parsed[index], [...path, String(index)]) : []
    );
  }

  if (!isPlainObject(raw) || !isPlainObject(parsed)) return [];

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

/**
 * Shaped as a ZodError so it travels the same road as every other validation
 * failure: `error.validation`, 400, with the offending paths in the details
 * (middleware/errorHandler.ts). The frontend already renders that key, so
 * this needs no new message and no new translation.
 */
function unknownFieldError(paths: string[][]): ZodError {
  const issues = paths.map(
    (path): ZodIssue => ({
      code: "unrecognized_keys",
      keys: [path[path.length - 1]!],
      path: path.slice(0, -1),
      message: UNKNOWN_FIELD_MESSAGE,
    })
  );
  return new ZodError(issues);
}
