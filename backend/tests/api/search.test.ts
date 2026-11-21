import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anyCategoryId } from "@tests/support/fixtures";
import { searchUntil } from "@tests/support/search";
import type { ProductDto } from "@tests/types";

// A single fixture product carries three distinct-language names built
// around one shared nonce, so every assertion below can search for a term
// that could ONLY match this run's product (never a leftover from a
// previous run or a seeded sample).
describe("Search", () => {
  const nonce = uniqueId();
  let productId: string | undefined;

  beforeAll(async () => {
    const admin = await getSession("ADMIN");
    const categoryId = await anyCategoryId(admin.token);
    const res = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: admin.token,
      body: {
        name: {
          ar: `اختبار${nonce} فراشة`,
          en: `${nonce} Butterfly Jacket`,
          he: `${nonce} פרפר`,
        },
        categoryId,
        basePrice: "10",
      },
    });
    expect(res.status).toBe(201);
    productId = res.data!.id;
  });

  afterAll(async () => {
    if (!productId) {
      return;
    }
    const admin = await getSession("ADMIN");
    await apiRequest(`/api/products/${productId}`, { method: "DELETE", token: admin.token });
  });

  const finds = (ids: string[]) => ids.includes(productId!);

  it("finds the product by its Arabic name", async () => {
    const admin = await getSession("ADMIN");
    const res = await searchUntil(admin.token, `اختبار${nonce}`, finds);
    expect(res.status).toBe(200);
    expect(finds(res.ids)).toBe(true);
  });

  it("finds the same product by its English name (cross-language: search covers every stored language, not just the caller's UI language)", async () => {
    const admin = await getSession("ADMIN");
    const res = await searchUntil(admin.token, `${nonce} Butterfly`, finds);
    expect(res.status).toBe(200);
    expect(finds(res.ids)).toBe(true);
  });

  it("tolerates a one-letter typo", async () => {
    const admin = await getSession("ADMIN");
    // "Buterfly" (missing a 't') instead of "Butterfly".
    const res = await searchUntil(admin.token, `${nonce} Buterfly`, finds);
    expect(res.status).toBe(200);
    expect(finds(res.ids)).toBe(true);
  });

  it("finds an Arabic word typed with the article it was saved without", async () => {
    const admin = await getSession("ADMIN");
    const res = await searchUntil(admin.token, `اختبار${nonce} الفراشة`, finds);
    expect(res.status).toBe(200);
    expect(finds(res.ids)).toBe(true);
  });

  it("drops a deleted product from the results", async () => {
    const admin = await getSession("ADMIN");
    const created = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: admin.token,
      body: {
        name: { ar: `محذوف${nonce}`, en: `Deleted ${nonce}` },
        categoryId: await anyCategoryId(admin.token),
        basePrice: "10",
      },
    });
    expect(created.status).toBe(201);
    const id = created.data!.id;
    expect((await searchUntil(admin.token, `محذوف${nonce}`, (ids) => ids.includes(id))).ids).toContain(id);

    await apiRequest(`/api/products/${id}`, { method: "DELETE", token: admin.token });
    expect((await searchUntil(admin.token, `محذوف${nonce}`, (ids) => !ids.includes(id))).ids).not.toContain(id);
  });
});

// The acceptance list from the search brief: every query finds the shawl, and it outranks pieces matching fewer words.
describe("Search — closest match first", () => {
  const nonce = uniqueId();
  const created: string[] = [];
  let targetId: string;
  let fewerWordIds: string[];

  async function createProduct(token: string, categoryId: string, ar: string) {
    const res = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token,
      body: { name: { ar, en: `Acceptance ${nonce}` }, categoryId, basePrice: "10" },
    });
    expect(res.status).toBe(201);
    created.push(res.data!.id);
    return res.data!.id;
  }

  beforeAll(async () => {
    const admin = await getSession("ADMIN");
    const categoryId = await anyCategoryId(admin.token);
    targetId = await createProduct(admin.token, categoryId, "شال معرق شيفون خميل");
    fewerWordIds = [
      await createProduct(admin.token, categoryId, "شال قطن ناعم"),
      await createProduct(admin.token, categoryId, "شيفون سادة"),
    ];
  });

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    for (const id of created) {
      await apiRequest(`/api/products/${id}`, { method: "DELETE", token: admin.token });
    }
  });

  it("is answered by Meilisearch (the cases below are what the pg_trgm fallback cannot do)", async () => {
    const health = await apiRequest<{ search: { engine: string; reachable: boolean } }>("/health");
    expect(health.data!.search).toEqual({ engine: "meilisearch", reachable: true });
  });

  it.each(["شال شيفون", "شال خميل", "شيفون معرق", "شيفن", "شال شيفوون"])(
    "%s finds شال معرق شيفون خميل, above products matching fewer words",
    async (query) => {
      const admin = await getSession("ADMIN");
      const res = await searchUntil(admin.token, query, (ids) => ids.includes(targetId));
      expect(res.status).toBe(200);
      const target = res.ids.indexOf(targetId);
      expect(target).toBeGreaterThanOrEqual(0);
      if (query.includes(" ")) {
        for (const id of fewerWordIds) {
          const other = res.ids.indexOf(id);
          if (other >= 0) {
            expect(target).toBeLessThan(other);
          }
        }
      }
    },
  );

  it("matches an SKU exactly, never a neighbouring code", async () => {
    const admin = await getSession("ADMIN");
    const product = await apiRequest<ProductDto>(`/api/products/${targetId}`, { token: admin.token });
    const sku = product.data!.sku!;
    const res = await searchUntil(admin.token, sku, (ids) => ids.includes(targetId));
    expect(res.ids).toContain(targetId);
    const neighbour = sku.replace(/\d$/, (d) => String((Number(d) + 1) % 10));
    const other = await searchUntil(admin.token, neighbour, () => true);
    expect(other.ids).not.toContain(targetId);
  });
});
