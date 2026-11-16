import { randomUUID } from 'node:crypto';
import type { Role } from '@organza/shared';
import { PasswordService } from '../../src/modules/auth/services/password.service.js';
import { users } from '../../src/database/schema/index.js';
import type { TestContext } from './test-app.js';

export const TEST_PASSWORD = 'correct-horse-battery';
let cachedHash: Promise<string> | undefined;

export async function createUser(
  ctx: TestContext,
  role: Role,
  overrides: Partial<typeof users.$inferInsert> = {},
) {
  cachedHash ??= new PasswordService().hash(TEST_PASSWORD);
  const [row] = await ctx.db
    .insert(users)
    .values({
      email: `${role.toLowerCase()}-${randomUUID()}@organza.test`,
      name: `${role} ${randomUUID().slice(0, 6)}`,
      role,
      passwordHash: await cachedHash,
      ...overrides,
    })
    .returning();
  if (!row) throw new Error('user not created');
  return row;
}

export async function login(ctx: TestContext, email: string, password = TEST_PASSWORD) {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
  });
  if (res.statusCode !== 200) throw new Error(`login failed ${res.statusCode} ${res.body}`);
  const body = res.json<{ accessToken: string }>();
  const cookie = res.cookies.find((c) => c.name === 'organza_refresh');
  return { token: body.accessToken, refreshCookie: cookie?.value, body };
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

export async function signedIn(ctx: TestContext, role: Role) {
  const user = await createUser(ctx, role);
  const { token } = await login(ctx, user.email);
  return { user, token, headers: bearer(token) };
}

/** Drizzle wraps the Postgres error; this checks the database's own message. */
export async function expectDbError(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  if (!caught) throw new Error(`Expected a database error matching ${pattern}`);
  const messages: string[] = [];
  for (let current: unknown = caught; current; current = (current as { cause?: unknown }).cause) {
    messages.push(String((current as { message?: unknown }).message ?? current));
  }
  if (!messages.some((m) => pattern.test(m))) {
    throw new Error(`Expected ${pattern}, got: ${messages.join(' | ')}`);
  }
}
