import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api-client';
import { authTokens } from './auth-tokens';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('api client', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    authTokens.set('old');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('refreshes once for concurrent 401s and retries each request', async () => {
    let refreshes = 0;
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        refreshes++;
        return json(200, {
          accessToken: 'new',
          expiresIn: 900,
          user: { id: 'u', capabilities: [] },
        });
      }
      const auth = (init?.headers as Record<string, string>)['authorization'];
      return auth === 'Bearer new'
        ? json(200, { ok: url })
        : json(401, { code: 'UNAUTHENTICATED' });
    });
    const [a, b] = await Promise.all([api.get('/a'), api.get('/b')]);
    expect(refreshes).toBe(1);
    expect(a).toEqual({ ok: '/api/a' });
    expect(b).toEqual({ ok: '/api/b' });
  });

  it('ends the session when the refresh is refused', async () => {
    const ended = vi.fn();
    const off = authTokens.onSessionEnded(ended);
    fetchMock.mockImplementation(async () => json(401, { code: 'UNAUTHENTICATED' }));
    await expect(api.get('/x')).rejects.toBeInstanceOf(ApiError);
    expect(ended).toHaveBeenCalled();
    off();
  });

  it('surfaces the API error code', async () => {
    fetchMock.mockResolvedValue(json(409, { code: 'STAFF_LAST_ADMIN', message: 'x' }));
    await expect(api.patch('/staff/1', {})).rejects.toMatchObject({
      code: 'STAFF_LAST_ADMIN',
      status: 409,
    });
  });
});
