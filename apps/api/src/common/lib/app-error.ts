import { ERROR_CODES, type ErrorCode } from '@organza/shared';

/** A domain error with a stable code the web app can translate. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message?: string,
    readonly details?: unknown,
  ) {
    super(message ?? code);
  }
}

export const notFound = (what = 'Resource', code: ErrorCode = ERROR_CODES.NOT_FOUND) =>
  new AppError(404, code, `${what} not found`);
export const conflict = (code: ErrorCode, message?: string, details?: unknown) =>
  new AppError(409, code, message, details);
export const badRequest = (code: ErrorCode, message?: string, details?: unknown) =>
  new AppError(400, code, message, details);
export const forbidden = (code: ErrorCode = ERROR_CODES.FORBIDDEN, message?: string) =>
  new AppError(403, code, message);
