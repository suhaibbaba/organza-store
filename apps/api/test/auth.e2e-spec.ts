import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { auditLog, refreshTokens } from '../src/database/schema/index.js';
import { bearer, createUser, login, signedIn, TEST_PASSWORD } from './helpers/fixtures.js';
import { createTestContext, type TestContext } from './helpers/test-app.js';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');

describe('auth', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(() => ctx.close());

  it('signs in, sets an httpOnly refresh cookie and returns capabilities', async () => {
    const user = await createUser(ctx, 'EMPLOYEE');
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: user.email.toUpperCase(), password: TEST_PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.refreshToken).toBeUndefined();
    expect(body.user.capabilities).toContain('account.self');
    expect(body.user.capabilities).not.toContain('staff.manage');
    const cookie = res.cookies.find((c) => c.name === 'organza_refresh');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe('/');
    const audits = await ctx.db.select().from(auditLog).where(eq(auditLog.entityId, user.id));
    expect(audits.map((a) => a.action)).toContain('LOGIN');
  });

  it('rejects a wrong password and an unknown email the same way', async () => {
    const user = await createUser(ctx, 'EMPLOYEE');
    const wrong = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: user.email, password: 'nope' },
    });
    const unknown = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ghost@organza.test', password: 'nope' },
    });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json().code).toBe('LOGIN_INVALID');
    expect(unknown.json().code).toBe('LOGIN_INVALID');
  });

  it('locks an account after five failures', async () => {
    const user = await createUser(ctx, 'EMPLOYEE');
    for (let i = 0; i < 5; i++) {
      await ctx.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: user.email, password: 'bad' },
      });
    }
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: user.email, password: TEST_PASSWORD },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().code).toBe('LOGIN_LOCKED');
  });

  it('refuses a deactivated user', async () => {
    const user = await createUser(ctx, 'EMPLOYEE', { isActive: false });
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: user.email, password: TEST_PASSWORD },
    });
    expect(res.statusCode).toBe(401);
  });

  const refresh = (token: string) =>
    ctx.app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { organza_refresh: token },
      payload: {},
    });
  const cookieOf = (res: Awaited<ReturnType<typeof refresh>>) =>
    res.cookies.find((c) => c.name === 'organza_refresh')?.value;

  it('rotates the refresh token and treats a late reuse as theft', async () => {
    const user = await createUser(ctx, 'EMPLOYEE');
    const { refreshCookie } = await login(ctx, user.email);
    const first = await refresh(refreshCookie!);
    expect(first.statusCode).toBe(200);
    const rotated = cookieOf(first);
    expect(rotated).toBeDefined();
    expect(rotated).not.toBe(refreshCookie);

    // The old token comes back after the grace window: every session of the user ends,
    // including the rotated one.
    await ctx.db
      .update(refreshTokens)
      .set({ revokedAt: new Date(Date.now() - 60_000) })
      .where(eq(refreshTokens.userId, user.id));
    await ctx.db
      .update(refreshTokens)
      .set({ revokedAt: null })
      .where(eq(refreshTokens.tokenHash, digest(rotated!)));
    const reuse = await refresh(refreshCookie!);
    expect(reuse.statusCode).toBe(401);
    const afterReuse = await refresh(rotated!);
    expect(afterReuse.statusCode).toBe(401);
  });

  it('lets a just-rotated token continue the session (a reload mid-refresh, two tabs)', async () => {
    const user = await createUser(ctx, 'EMPLOYEE');
    const { refreshCookie } = await login(ctx, user.email);
    const first = await refresh(refreshCookie!);
    expect(first.statusCode).toBe(200);
    const again = await refresh(refreshCookie!);
    expect(again.statusCode).toBe(200);
    const newest = cookieOf(again);
    expect(newest).toBeDefined();
    expect(await refresh(newest!)).toHaveProperty('statusCode', 200);
  });

  it('survives several refreshes sent at the same moment (tabs opening together)', async () => {
    const user = await createUser(ctx, 'EMPLOYEE');
    const { refreshCookie } = await login(ctx, user.email);
    const results = await Promise.all(Array.from({ length: 4 }, () => refresh(refreshCookie!)));
    expect(results.map((r) => r.statusCode)).toEqual([200, 200, 200, 200]);
    const live = await ctx.db
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.userId, user.id), isNull(refreshTokens.revokedAt)));
    expect(live).toHaveLength(1);
  });

  it('gives the desktop client its refresh token in the body', async () => {
    const user = await createUser(ctx, 'EMPLOYEE');
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: user.email, password: TEST_PASSWORD, client: 'desktop' },
    });
    const token = res.json().refreshToken as string;
    expect(token).toBeTruthy();
    expect(res.cookies.find((c) => c.name === 'organza_refresh')).toBeUndefined();
    const refreshed = await ctx.app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: token },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json().refreshToken).toBeTruthy();
  });

  it('logout revokes the refresh token', async () => {
    const user = await createUser(ctx, 'EMPLOYEE');
    const { refreshCookie } = await login(ctx, user.email);
    await ctx.app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { organza_refresh: refreshCookie! },
      payload: {},
    });
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { organza_refresh: refreshCookie! },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });

  it('changing the password ends other sessions', async () => {
    const user = await createUser(ctx, 'EMPLOYEE');
    const { token, refreshCookie } = await login(ctx, user.email);
    const change = await ctx.app.inject({
      method: 'POST',
      url: '/auth/password',
      headers: bearer(token),
      payload: { currentPassword: TEST_PASSWORD, newPassword: 'another-long-password' },
    });
    expect(change.statusCode).toBe(204);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { organza_refresh: refreshCookie! },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('guards', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(() => ctx.close());

  it('requires a token on non-public routes', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
    const bad = await ctx.app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: bearer('not-a-jwt'),
    });
    expect(bad.statusCode).toBe(401);
  });

  it('enforces capabilities by fixed role', async () => {
    const employee = await signedIn(ctx, 'EMPLOYEE');
    const manager = await signedIn(ctx, 'MANAGER');
    const admin = await signedIn(ctx, 'ADMIN');
    expect(
      (await ctx.app.inject({ method: 'GET', url: '/staff', headers: employee.headers }))
        .statusCode,
    ).toBe(403);
    expect(
      (await ctx.app.inject({ method: 'GET', url: '/staff', headers: manager.headers })).statusCode,
    ).toBe(403);
    expect(
      (await ctx.app.inject({ method: 'GET', url: '/staff', headers: admin.headers })).statusCode,
    ).toBe(200);
  });

  it('a deactivated user loses access at once, even with a valid token', async () => {
    const admin = await signedIn(ctx, 'ADMIN');
    const employee = await signedIn(ctx, 'EMPLOYEE');
    const off = await ctx.app.inject({
      method: 'PATCH',
      url: `/staff/${employee.user.id}`,
      headers: admin.headers,
      payload: { isActive: false },
    });
    expect(off.statusCode).toBe(200);
    const res = await ctx.app.inject({ method: 'GET', url: '/auth/me', headers: employee.headers });
    expect(res.statusCode).toBe(401);
  });

  it('keeps at least one active admin', async () => {
    const admin = await signedIn(ctx, 'ADMIN');
    const self = await ctx.app.inject({
      method: 'PATCH',
      url: `/staff/${admin.user.id}`,
      headers: admin.headers,
      payload: { isActive: false },
    });
    expect(self.json().code).toBe('STAFF_SELF_DEACTIVATE');
  });
});
