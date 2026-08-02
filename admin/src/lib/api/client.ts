import { ERROR_CODES } from "@shared/constants/errors";
import type { ApiEnvelope, Pagination } from "@shared/types/common";
import { API_BASE_URL } from "@/lib/env";
import { getStoredToken } from "@/lib/auth/session-storage";
import { ApiError } from "@/lib/api/errors";

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

interface ApiResult<T> {
  data: T;
  meta: Pagination | null;
}

// Typed wrapper around fetch for our own `/api/*` REST routes: adds the
// bearer token + Origin (sent automatically by the browser on cross-origin
// requests — the backend rejects requests missing it), and unwraps the
// unified envelope (CLAUDE.md rule 15). Not used for Better Auth's own
// `/api/auth/*` routes, which don't follow this envelope — see lib/auth/client.ts.
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<ApiResult<T>> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!json || !json.success) {
    throw new ApiError(res.status, json?.error.code ?? ERROR_CODES.INTERNAL, json?.error.details);
  }
  if (!res.ok) {
    throw new ApiError(res.status, ERROR_CODES.INTERNAL);
  }

  return { data: json.data, meta: json.meta ?? null };
}
