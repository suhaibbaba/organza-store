import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "../support/client";
import { getSession } from "../support/auth";
import { anyCategoryId } from "../support/fixtures";

interface ProductSummary {
  id: string;
}

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
    const res = await apiRequest<{ id: string }>("/api/products", {
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
    if (!productId) return;
    const admin = await getSession("ADMIN");
    await apiRequest(`/api/products/${productId}`, { method: "DELETE", token: admin.token });
  });

  it("finds the product by its Arabic name", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<ProductSummary[]>(`/api/products?q=${encodeURIComponent(`اختبار${nonce}`)}`, {
      token: admin.token,
    });
    expect(res.status).toBe(200);
    expect(res.data!.some((p) => p.id === productId)).toBe(true);
  });

  it("finds the same product by its English name (cross-language: search covers every stored language, not just the caller's UI language)", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<ProductSummary[]>(`/api/products?q=${encodeURIComponent(`${nonce} Butterfly`)}`, {
      token: admin.token,
    });
    expect(res.status).toBe(200);
    expect(res.data!.some((p) => p.id === productId)).toBe(true);
  });

  it("tolerates a one-letter typo via pg_trgm fuzzy matching", async () => {
    const admin = await getSession("ADMIN");
    // "Buterfly" (missing a 't') instead of "Butterfly".
    const res = await apiRequest<ProductSummary[]>(`/api/products?q=${encodeURIComponent(`${nonce} Buterfly`)}`, {
      token: admin.token,
    });
    expect(res.status).toBe(200);
    expect(res.data!.some((p) => p.id === productId)).toBe(true);
  });
});
