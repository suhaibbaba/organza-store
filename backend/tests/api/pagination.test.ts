import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "../support/client";
import { getSession } from "../support/auth";

interface ProductSummary {
  id: string;
  basePrice: number | string;
}

// A dedicated, freshly-created category scopes every assertion to exactly
// the 3 products this suite creates, independent of whatever else exists in
// the sandbox's catalog.
describe("Products pagination + filtering + sorting", () => {
  const nonce = uniqueId();
  const prices = [10, 30, 20];
  let categoryId: string | undefined;
  const productIds: string[] = [];

  beforeAll(async () => {
    const admin = await getSession("ADMIN");
    const category = await apiRequest<{ id: string }>("/api/categories", {
      method: "POST",
      token: admin.token,
      body: { name: { ar: `تصنيف اختبار ${nonce}`, en: `Vitest Category ${nonce}` } },
    });
    expect(category.status).toBe(201);
    categoryId = category.data!.id;

    for (const price of prices) {
      const res = await apiRequest<{ id: string }>("/api/products", {
        method: "POST",
        token: admin.token,
        body: {
          name: { ar: `منتج ${nonce} ${price}`, en: `Vitest Page ${nonce} ${price}` },
          categoryId,
          basePrice: String(price),
        },
      });
      expect(res.status).toBe(201);
      productIds.push(res.data!.id);
    }
  });

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    for (const id of productIds) {
      await apiRequest(`/api/products/${id}`, { method: "DELETE", token: admin.token });
    }
    if (categoryId) await apiRequest(`/api/categories/${categoryId}`, { method: "DELETE", token: admin.token });
  });

  it("filters by categoryId and paginates with pageSize=2", async () => {
    const admin = await getSession("ADMIN");
    const page1 = await apiRequest<ProductSummary[]>(
      `/api/products?categoryId=${categoryId}&pageSize=2&page=1&sortBy=basePrice&sortDir=asc`,
      { token: admin.token }
    );
    expect(page1.status).toBe(200);
    expect(page1.meta).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    expect(page1.data!.map((p) => Number(p.basePrice))).toEqual([10, 20]);

    const page2 = await apiRequest<ProductSummary[]>(
      `/api/products?categoryId=${categoryId}&pageSize=2&page=2&sortBy=basePrice&sortDir=asc`,
      { token: admin.token }
    );
    expect(page2.status).toBe(200);
    expect(page2.meta).toMatchObject({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
    expect(page2.data!.map((p) => Number(p.basePrice))).toEqual([30]);
  });

  it("sorts by basePrice descending", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<ProductSummary[]>(`/api/products?categoryId=${categoryId}&sortBy=basePrice&sortDir=desc`, {
      token: admin.token,
    });
    expect(res.data!.map((p) => Number(p.basePrice))).toEqual([30, 20, 10]);
  });

  it("filters by price range", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<ProductSummary[]>(`/api/products?categoryId=${categoryId}&priceMin=15&priceMax=25`, {
      token: admin.token,
    });
    expect(res.data!.map((p) => Number(p.basePrice))).toEqual([20]);
  });
});
