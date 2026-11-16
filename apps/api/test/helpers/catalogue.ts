import { randomUUID } from 'node:crypto';
import type { ProductView } from '@organza/shared';
import type { TestContext } from './test-app.js';

type Headers = Record<string, string>;

export async function createCategory(
  ctx: TestContext,
  headers: Headers,
  name = `Cat ${randomUUID().slice(0, 6)}`,
) {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/categories',
    headers,
    payload: { name: { ar: name, en: name } },
  });
  if (res.statusCode !== 201) throw new Error(`category ${res.statusCode} ${res.body}`);
  return res.json<{ id: string }>();
}

export async function createProduct(
  ctx: TestContext,
  headers: Headers,
  payload: Record<string, unknown>,
) {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/products',
    headers,
    payload: { idempotencyKey: randomUUID(), price: '100.00', ...payload },
  });
  if (res.statusCode !== 201) throw new Error(`product ${res.statusCode} ${res.body}`);
  return res.json<ProductView>();
}

export async function optionValues(
  ctx: TestContext,
  headers: Headers,
  key: string,
  names: string[],
) {
  const types = (await ctx.app.inject({ method: 'GET', url: '/option-types', headers })).json<
    { id: string; key: string; values: { id: string; value: { en?: string } }[] }[]
  >();
  const type = types.find((t) => t.key === key)!;
  const ids: string[] = [];
  for (const name of names) {
    const existing = type.values.find((v) => v.value.en === name);
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/option-types/${type.id}/values`,
      headers,
      payload: { value: { ar: name, en: name } },
    });
    if (res.statusCode !== 201) throw new Error(`value ${res.statusCode} ${res.body}`);
    ids.push(res.json<{ id: string }>().id);
  }
  return { typeId: type.id, ids };
}
