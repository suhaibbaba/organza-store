import { TARGET } from "@tests/support/target";
import { noteResponse } from "@tests/support/fixtureRegistry";
import type { ApiResult, RequestOptions } from "@tests/types";

// Hits a live API, never an in-process server; the target is decided in tests/support/target.ts.
export const API_BASE_URL = TARGET.url;

// Undici sends `Origin: null` on cross-origin writes, which Better Auth's CSRF guard refuses, so the API's own origin is declared.
export const API_ORIGIN = new URL(API_BASE_URL).origin;

export async function rawRequest(path: string, options: RequestOptions = {}): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { Origin: API_ORIGIN };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

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

  // Every create is recorded here, where all requests pass, so teardown needs no test to remember.
  noteResponse(path, options.method ?? "GET", status, body);

  return {
    status,
    success: Boolean(body?.success),
    data: body?.data,
    meta: body?.meta ?? null,
    error: body?.error,
  };
}

// Unique enough that repeated runs against one sandbox never collide.
export function uniqueId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
