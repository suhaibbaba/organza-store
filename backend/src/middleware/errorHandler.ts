import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError, sendError } from "@/lib/response";
import { captureException } from "@/lib/logger";
import { ERROR_CODES, type ErrorCode } from "@/constants";

// Shared schemas use their own zod copy, so `instanceof ZodError` fails across realms; matched by shape instead.
function isZodError(err: unknown): err is ZodError {
  return (
    err instanceof ZodError ||
    (err instanceof Error && err.name === "ZodError" && Array.isArray((err as { issues?: unknown }).issues))
  );
}

function codeForUniqueViolation(target: unknown): ErrorCode {
  const fields = Array.isArray(target) ? target.join(",") : String(target ?? "");
  if (fields.includes("sku")) {
    return ERROR_CODES.SKU_DUPLICATE;
  }
  if (fields.includes("barcode")) {
    return ERROR_CODES.BARCODE_DUPLICATE;
  }
  if (fields.includes("slug")) {
    return ERROR_CODES.SLUG_DUPLICATE;
  }
  if (fields.includes("email")) {
    return ERROR_CODES.EMAIL_DUPLICATE;
  }
  if (fields.includes("phone")) {
    return ERROR_CODES.PHONE_DUPLICATE;
  }
  if (fields.includes("whatsapp")) {
    return ERROR_CODES.WHATSAPP_DUPLICATE;
  }
  return ERROR_CODES.DUPLICATE;
}

// Every response uses the unified envelope (rule 15); errors are keys, never sentences (rule 12).
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

  // Anything here is a genuine fault, so it goes to error tracking (rule 20).
  captureException(err);
  sendError(res, new AppError(500, ERROR_CODES.INTERNAL));
};
