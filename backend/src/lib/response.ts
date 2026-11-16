import type { Response } from "express";
import type { Pagination } from "@/types";

export function sendOk<T>(res: Response, data: T, meta: Pagination | null = null, status = 200): void {
  res.status(status).json({ success: true, data, meta });
}

export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, details?: unknown) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function sendError(res: Response, error: AppError): void {
  res.status(error.status).json({
    success: false,
    error: { code: error.code, details: error.details },
  });
}
