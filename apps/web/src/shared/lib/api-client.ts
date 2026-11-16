import type { ApiErrorBody, LoginResponse } from '@organza/shared';
import { authTokens } from './auth-tokens';
import { tokenStore } from './token-store';

export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body?: ApiErrorBody,
  ) {
    super(body?.message ?? `HTTP ${status}`);
  }
  get code(): string | undefined {
    return this.body?.code;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

function url(path: string, query?: RequestOptions['query']): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const qs = search.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { ...options.headers };
  const token = authTokens.get();
  if (token) headers['authorization'] = `Bearer ${token}`;
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body !== undefined && !isForm) headers['content-type'] = 'application/json';
  return fetch(url(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    signal: options.signal ?? null,
    body:
      options.body === undefined
        ? null
        : isForm
          ? (options.body as FormData)
          : JSON.stringify(options.body),
  });
}

export type RefreshOutcome = 'refreshed' | 'signed-out' | 'unreachable';
let refreshInFlight: Promise<RefreshOutcome> | null = null;
let onRefreshed: ((response: LoginResponse) => void) | null = null;

export function setRefreshListener(listener: ((response: LoginResponse) => void) | null): void {
  onRefreshed = listener;
}

/** Single flight: concurrent 401s share one refresh request. */
export function refreshSession(): Promise<RefreshOutcome> {
  refreshInFlight ??= (async (): Promise<RefreshOutcome> => {
    try {
      const store = tokenStore.get();
      const stored = store.kind === 'secure-store' ? await store.load() : null;
      if (store.kind === 'secure-store' && !stored) return 'signed-out';
      const response = await send('/auth/refresh', {
        method: 'POST',
        body: stored ? { refreshToken: stored } : {},
      });
      if (response.status >= 500) return 'unreachable';
      if (!response.ok) {
        await store.clear();
        return 'signed-out';
      }
      const body = (await response.json()) as LoginResponse;
      authTokens.set(body.accessToken);
      if (body.refreshToken) await store.save(body.refreshToken);
      onRefreshed?.(body);
      return 'refreshed';
    } catch {
      return 'unreachable';
    } finally {
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();
  return refreshInFlight;
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const type = response.headers.get('content-type') ?? '';
  return (type.includes('application/json') ? response.json() : response.text()) as Promise<T>;
}

async function toError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => undefined)) as ApiErrorBody | undefined;
  return new ApiError(response.status, body);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);
  if (response.status === 401 && !path.startsWith('/auth/')) {
    const outcome = await refreshSession();
    if (outcome === 'signed-out') {
      authTokens.notifySessionEnded();
      throw new ApiError(401);
    }
    if (outcome === 'unreachable') throw new ApiError(503);
    response = await send(path, options);
    if (response.status === 401) {
      authTokens.notifySessionEnded();
      throw new ApiError(401);
    }
  }
  if (!response.ok) throw await toError(response);
  return parse<T>(response);
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) => apiRequest<T>(path, { query }),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'POST', body: body ?? {} }),
  patch: <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};

/** A fresh idempotency key for one attempt at a create; reuse it for retries of that attempt. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
