import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { createCategory, createProduct } from './helpers/catalogue.js';
import { signedIn } from './helpers/fixtures.js';
import { createTestContext, type TestContext } from './helpers/test-app.js';

async function multipart(
  fields: Record<string, string>,
  file: { name: string; type: string; data: Buffer },
) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append('file', new Blob([new Uint8Array(file.data)], { type: file.type }), file.name);
  const req = new Request('http://local', { method: 'POST', body: form });
  return {
    payload: Buffer.from(await req.arrayBuffer()),
    contentType: req.headers.get('content-type')!,
  };
}

const photo = (width = 1200, height = 1800, color = { r: 20, g: 20, b: 20 }) =>
  sharp({ create: { width, height, channels: 3, background: color } })
    .jpeg()
    .toBuffer();

describe('product images', () => {
  let ctx: TestContext;
  let admin: Awaited<ReturnType<typeof signedIn>>;
  let employee: Awaited<ReturnType<typeof signedIn>>;
  let categoryId: string;

  const upload = async (
    headers: Record<string, string>,
    fields: Record<string, string> = {},
    data?: Buffer,
    type = 'image/jpeg',
  ) => {
    const body = await multipart(fields, { name: 'p.jpg', type, data: data ?? (await photo()) });
    return ctx.app.inject({
      method: 'POST',
      url: '/images',
      headers: { ...headers, 'content-type': body.contentType },
      payload: body.payload,
    });
  };
  const fileOf = (url: string) => join(resolve(env().UPLOAD_DIR), url.replace('/uploads/', ''));

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await signedIn(ctx, 'ADMIN');
    employee = await signedIn(ctx, 'EMPLOYEE');
    categoryId = (await createCategory(ctx, admin.headers)).id;
  });
  afterAll(() => ctx.close());

  it('stores three WebP sizes and the original, and measures brightness', async () => {
    const res = await upload(employee.headers);
    expect(res.statusCode).toBe(201);
    const img = res.json();
    for (const url of [img.thumbnailUrl, img.mediumUrl, img.fullUrl, img.originalUrl])
      expect(existsSync(fileOf(url))).toBe(true);
    const meta = await sharp(fileOf(img.thumbnailUrl)).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width!, meta.height!)).toBe(300);
    expect(Number(img.brightness)).toBeLessThan(20);
    const served = await ctx.app.inject({ method: 'GET', url: img.thumbnailUrl });
    expect(served.statusCode).toBe(200);
  });

  it('refuses a file that is not really an image', async () => {
    const res = await upload(employee.headers, {}, Buffer.from('<?php echo 1; ?>'), 'image/png');
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('IMAGE_INVALID');
  });

  it('applies the crop on upload and re-crops from the original', async () => {
    const edit = {
      crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
      rotation: 90,
      flipHorizontal: false,
      flipVertical: false,
    };
    const img = (await upload(employee.headers, { edit: JSON.stringify(edit) })).json();
    const full = await sharp(fileOf(img.fullUrl)).metadata();
    // Turned frame 1800×1200, top-left quarter 900×600, then turned back upright: 900 wide.
    expect([full.width, full.height]).toEqual([900, 600]);
    const re = await ctx.app.inject({
      method: 'POST',
      url: `/images/${img.id}/crop`,
      headers: employee.headers,
      payload: { crop: null, rotation: 0, flipHorizontal: false, flipVertical: false },
    });
    expect(re.json().fullUrl).not.toBe(img.fullUrl);
    const after = await sharp(fileOf(re.json().fullUrl)).metadata();
    expect([after.width, after.height]).toEqual([1067, 1600]);
  });

  it('attaches uploaded photos when the product is saved, first one main; reorders and removes', async () => {
    const a = (await upload(employee.headers)).json();
    const b = (await upload(employee.headers)).json();
    const p = await createProduct(ctx, employee.headers, {
      type: 'REGULAR',
      name: { ar: 'صور' },
      categoryId,
      imageIds: [a.id, b.id],
    });
    expect(p.images.map((i) => [i.id, i.isPrimary])).toEqual([
      [a.id, true],
      [b.id, false],
    ]);
    const reordered = await ctx.app.inject({
      method: 'POST',
      url: `/products/${p.id}/images/order`,
      headers: employee.headers,
      payload: { imageIds: [b.id, a.id] },
    });
    expect(reordered.json()[0]).toMatchObject({ id: b.id, isPrimary: true });
    expect(
      (
        await ctx.app.inject({
          method: 'DELETE',
          url: `/images/${b.id}`,
          headers: employee.headers,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await ctx.app.inject({ method: 'DELETE', url: `/images/${b.id}`, headers: admin.headers }))
        .statusCode,
    ).toBe(200);
    const view = (
      await ctx.app.inject({ method: 'GET', url: `/products/${p.id}`, headers: admin.headers })
    ).json();
    expect(view.images).toHaveLength(1);
    expect(view.images[0]).toMatchObject({ id: a.id, isPrimary: true });
  });

  it('uploads straight onto an existing product', async () => {
    const p = await createProduct(ctx, admin.headers, {
      type: 'REGULAR',
      name: { ar: 'مباشر' },
      categoryId,
    });
    const img = (await upload(employee.headers, { productId: p.id })).json();
    expect(img.isPrimary).toBe(true);
    const missing = await upload(employee.headers, { productId: randomUUID() });
    expect(missing.statusCode).toBe(404);
  });
});
