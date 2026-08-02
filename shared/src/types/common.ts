export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Translatable content { ar, en, he } — CLAUDE.md rule 9.
export type I18n = Record<string, string | null | undefined>;

// Unified API envelope (CLAUDE.md rule 15) — every backend endpoint responds
// with one of these two shapes.
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Pagination | null;
}

export interface ApiErrorBody {
  code: string;
  details?: unknown;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;
