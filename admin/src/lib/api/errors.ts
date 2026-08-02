// Thrown for every non-2xx response from our own `/api/*` envelope
// (CLAUDE.md rule 15). `code` is always a backend translation key
// (e.g. "error.validation.required") — see ERROR_MESSAGE_KEYS for how it's
// turned into display text.
export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, details?: unknown) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
