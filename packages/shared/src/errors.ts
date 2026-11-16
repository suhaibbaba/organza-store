/**
 * Every API error body is `{ code, message, details? }`. The web app translates `code`;
 * `message` is English for logs only.
 */
export const ERROR_CODES = {
  VALIDATION: 'VALIDATION',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL',
  LOGIN_INVALID: 'LOGIN_INVALID',
  LOGIN_LOCKED: 'LOGIN_LOCKED',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  APPEND_ONLY: 'APPEND_ONLY',
  CONSTRAINT: 'CONSTRAINT',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES] | (string & {});

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}
