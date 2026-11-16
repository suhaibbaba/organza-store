import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { auditLog } from '../src/database/schema/index.js';
import { bearer, createUser, login, signedIn, TEST_PASSWORD } from './helpers/fixtures.js';
import { createTestContext, type TestContext } from './helpers/test-app.js';

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

  it('rotates the refresh token and detects reuse', async () => {
    const user = await createUser(ctx, 'EMPLOYEE');
    const { refreshCookie } = await login(ctx, user.email);
    const first = await ctx.app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { organza_refresh: refreshCookie! },
      payload: {},
    });
    expect(first.statusCode).toBe(200);
    const rotated = first.cookies.find((c) => c.name === 'organza_refresh')?.value;
    expect(rotated).toBeDefined();
    expect(rotated).not.toBe(refreshCookie);

    // The old token comes back: every session of the user ends, including the rotated one.
    const reuse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { organza_refresh: refreshCookie! },
      payload: {},
    });
    expect(reuse.statusCode).toBe(401);
    const afterReuse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { organza_refresh: rotated! },
      payload: {},
    });
    expect(afterReuse.statusCode).toBe(401);
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
