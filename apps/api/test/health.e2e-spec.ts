import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from './helpers/test-app.js';

describe('health', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(() => ctx.close());

  it('reports the database as up', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', database: 'up' });
  });
});
