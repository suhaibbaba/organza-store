export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
}

// Every backend route (CLAUDE.md rule 15) responds with the unified
// envelope; Better Auth's own routes (/api/auth/*) do not, so those callers
// use `rawRequest` instead (see tests/support/auth.ts).
export interface ApiResult<T = unknown> {
  status: number;
  success: boolean;
  data?: T;
  meta?: { page: number; pageSize: number; total: number; totalPages: number } | null;
  error?: { code: string; details?: unknown };
}

export interface ErrorBody {
  error?: { code: string };
}
