import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "../support/client";
import { getSession } from "../support/auth";
import { anyCategoryId, twoByTwoOptionSelections } from "../support/fixtures";
import { ERROR_CODES } from "@/constants";

interface StockItem {
  id: string;
  stock: number;
}

describe("Inventory", () => {
  const nonce = uniqueId();
  let categoryId: string;
  let productId: string;

  beforeAll(async () => {
    const admin = await getSession("ADMIN");
    categoryId = await anyCategoryId(admin.token);
    const res = await apiRequest<{ id: string }>("/api/products", {
      method: "POST",
      token: admin.token,
      body: { name: { ar: `مخزون ${nonce}`, en: `Vitest Inventory ${nonce}` }, categoryId, basePrice: "40", stock: "10" },
    });
    expect(res.status).toBe(201);
    productId = res.data!.id;
  });

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    if (productId) await apiRequest(`/api/products/${productId}`, { method: "DELETE", token: admin.token });
  });

  it("lists the product in the flattened inventory view", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<StockItem[]>(`/api/inventory?q=${encodeURIComponent(`Vitest Inventory ${nonce}`)}`, {
      token: admin.token,
    });
    expect(res.status).toBe(200);
    expect(res.data!.some((i) => i.id === productId)).toBe(true);
  });

  it("forbids Employee from viewing inventory", async () => {
    const employee = await getSession("EMPLOYEE");
    const res = await apiRequest("/api/inventory", { token: employee.token });
    expect(res.status).toBe(403);
    expect(res.error?.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it("forbids Employee from adjusting stock", async () => {
    const employee = await getSession("EMPLOYEE");
    const res = await apiRequest(`/api/inventory/products/${productId}`, {
      method: "PATCH",
      token: employee.token,
      body: { stock: 5 },
    });
    expect(res.status).toBe(403);
    expect(res.error?.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  // Ordered deliberately: this lowers stock to 2 (<= the seeded default
  // lowStockThreshold of 3) so the very next test can rely on it surfacing
  // under the lowStock filter without touching the global Setting row.
  it("adjusts a simple product's stock", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<StockItem>(`/api/inventory/products/${productId}`, {
      method: "PATCH",
      token: admin.token,
      body: { stock: 2 },
    });
    expect(res.status).toBe(200);
    expect(res.data!.stock).toBe(2);
  });

  it("surfaces the product under lowStock once its stock is at/below the threshold", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<StockItem[]>(
      `/api/inventory?lowStock=true&q=${encodeURIComponent(`Vitest Inventory ${nonce}`)}`,
      { token: admin.token }
    );
    expect(res.status).toBe(200);
    expect(res.data!.some((i) => i.id === productId)).toBe(true);
  });

  it("adjusts a variant's stock via the inventory route", async () => {
    const admin = await getSession("ADMIN");
    const optionSelections = await twoByTwoOptionSelections(admin.token);
    const created = await apiRequest<{ id: string; variants: { id: string }[] }>("/api/products", {
      method: "POST",
      token: admin.token,
      body: {
        name: { ar: `مخزون متغير ${nonce}`, en: `Vitest Variant Inventory ${nonce}` },
        categoryId,
        basePrice: "60",
        optionSelections,
      },
    });
    expect(created.status).toBe(201);
    const variantProductId = created.data!.id;
    const variantId = created.data!.variants[0].id;

    try {
      const adjust = await apiRequest<StockItem>(`/api/inventory/variants/${variantId}`, {
        method: "PATCH",
        token: admin.token,
        body: { stock: 7 },
      });
      expect(adjust.status).toBe(200);
      expect(adjust.data!.stock).toBe(7);
    } finally {
      await apiRequest(`/api/products/${variantProductId}`, { method: "DELETE", token: admin.token });
    }
  });
});
