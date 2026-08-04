import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError, sendError } from "@/lib/response";
import { captureException } from "@/lib/logger";
import { ERROR_CODES, type ErrorCode } from "@/constants";

// Schemas built from `@shared/schemas/*` are compiled against shared/'s own
// zod install — a separate copy of the package from backend's own
// node_modules/zod (each project here has its own package.json, CLAUDE.md's
// "Repo structure"; nothing hoists them together). A ZodError thrown while
// validating a shared schema is therefore a different realm's class, so
// `instanceof ZodError` fails even though it's the same error by name/shape
// — duck-type on that shape instead of trusting the prototype chain.
function isZodError(err: unknown): err is ZodError {
  return (
    err instanceof ZodError ||
    (err instanceof Error && err.name === "ZodError" && Array.isArray((err as { issues?: unknown }).issues))
  );
}

function codeForUniqueViolation(target: unknown): ErrorCode {
  const fields = Array.isArray(target) ? target.join(",") : String(target ?? "");
  if (fields.includes("sku")) return ERROR_CODES.SKU_DUPLICATE;
  if (fields.includes("barcode")) return ERROR_CODES.BARCODE_DUPLICATE;
  if (fields.includes("slug")) return ERROR_CODES.SLUG_DUPLICATE;
  if (fields.includes("email")) return ERROR_CODES.EMAIL_DUPLICATE;
  if (fields.includes("phone")) return ERROR_CODES.PHONE_DUPLICATE;
  if (fields.includes("whatsapp")) return ERROR_CODES.WHATSAPP_DUPLICATE;
  return ERROR_CODES.DUPLICATE;
}

// Every response — success or failure — goes out through the unified
// envelope (CLAUDE.md rule 15); errors are translation KEYS, never literal
// sentences (rule 12), so the frontend renders them via t().
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    sendError(res, err);
    return;
  }

  if (isZodError(err)) {
    sendError(res, new AppError(400, ERROR_CODES.VALIDATION, err.issues));
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      sendError(res, new AppError(409, codeForUniqueViolation(err.meta?.target)));
      return;
    }
    if (err.code === "P2025") {
      sendError(res, new AppError(404, ERROR_CODES.NOT_FOUND));
      return;
    }
  }

  // Anything reaching here is a genuine fault rather than a rejected
  // request, so it goes to the error-tracking layer (CLAUDE.md rule 20) —
  // which also logs it to the console.
  captureException(err);
  sendError(res, new AppError(500, ERROR_CODES.INTERNAL));
};
