import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError, sendError } from "../lib/response";

function codeForUniqueViolation(target: unknown): string {
  const fields = Array.isArray(target) ? target.join(",") : String(target ?? "");
  if (fields.includes("sku")) return "error.sku.duplicate";
  if (fields.includes("barcode")) return "error.barcode.duplicate";
  if (fields.includes("slug")) return "error.slug.duplicate";
  if (fields.includes("email")) return "error.email.duplicate";
  if (fields.includes("phone")) return "error.phone.duplicate";
  if (fields.includes("whatsapp")) return "error.whatsapp.duplicate";
  return "error.duplicate";
}

// Every response — success or failure — goes out through the unified
// envelope (CLAUDE.md rule 15); errors are translation KEYS, never literal
// sentences (rule 12), so the frontend renders them via t().
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    sendError(res, err);
    return;
  }

  if (err instanceof ZodError) {
    sendError(res, new AppError(400, "error.validation", err.issues));
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      sendError(res, new AppError(409, codeForUniqueViolation(err.meta?.target)));
      return;
    }
    if (err.code === "P2025") {
      sendError(res, new AppError(404, "error.not_found"));
      return;
    }
  }

  console.error(err);
  sendError(res, new AppError(500, "error.internal"));
};
