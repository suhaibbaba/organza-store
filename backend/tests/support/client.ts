import type { ApiResult, RequestOptions } from "@tests/types";

// Thin fetch wrapper around a LIVE API — these tests never start an
// in-process server, they hit whatever API_URL points at (sandbox or prod).
const rawApiUrl = process.env.API_URL;
if (!rawApiUrl) {
  throw new Error(
    "API_URL is not set. Run tests via `npm run api-test` (sandbox) or " +
      "`npm run api-test:prod` (production), or export API_URL yourself before invoking vitest."
  );
}

export const API_BASE_URL = rawApiUrl.replace(/\/+$/, "");

// Better Auth's CSRF guard (src/lib/auth.ts -> trustedOrigins) rejects any
// state-changing request that carries an Origin header it doesn't
// recognize — and per the Fetch spec, undici auto-sets `Origin: null` on
// cross-origin POST/PATCH/DELETE requests that don't set one themselves.
// The API's own baseURL origin is trusted by default, so declaring it
// explicitly here (overriding undici's "null") keeps every request passing
// as a legitimate first-party caller instead of tripping MISSING_OR_NULL_ORIGIN.
export const API_ORIGIN = new URL(API_BASE_URL).origin;

export async function rawRequest(path: string, options: RequestOptions = {}): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { Origin: API_ORIGIN };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export async function apiRequest<T = unknown>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { status, body } = await rawRequest(path, options);
  return {
    status,
    success: Boolean(body?.success),
    data: body?.data,
    meta: body?.meta ?? null,
    error: body?.error,
  };
}

// Unique-enough token for test fixtures (product names, category names,
// emails, ...) so repeated runs against the same sandbox never collide.
export function uniqueId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
