import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Setting } from "@prisma/client";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anyCategoryId, twoByTwoOptionSelections } from "@tests/support/fixtures";
import type { ProductDto, StockAdjustResult } from "@tests/types";
import { ERROR_CODES } from "@/constants";
import type { StockItem } from "@/types";

describe("Inventory", () => {
  const nonce = uniqueId();
  let categoryId: string;
  let productId: string;
  // Same low stock, but left at the default trackLowStock=false — used to
  // prove the low-stock filter is opt-in, not threshold-only.
  let untrackedProductId: string;
  // Read from Setting rather than hard-coded (CLAUDE.md rule 14), so these
  // assertions still mean something if the sandbox threshold changes.
  let threshold: number;

  beforeAll(async () => {
    const admin = await getSession("ADMIN");
    categoryId = await anyCategoryId(admin.token);
    const setting = await apiRequest<Setting>("/api/settings", { token: admin.token });
    expect(setting.status).toBe(200);
    threshold = setting.data!.lowStockThreshold;
    const res = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: admin.token,
      body: {
        name: { ar: `مخزون ${nonce}`, en: `Vitest Inventory ${nonce}` },
        categoryId,
        basePrice: "40",
        stock: "10",
        trackLowStock: true,
      },
    });
    expect(res.status).toBe(201);
    expect(res.data!.trackLowStock).toBe(true);
    productId = res.data!.id;

    const untracked = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: admin.token,
      body: {
        name: { ar: `مخزون بلا تتبع ${nonce}`, en: `Vitest Untracked Inventory ${nonce}` },
        categoryId,
        basePrice: "40",
        stock: "1",
      },
    });
    expect(untracked.status).toBe(201);
    // Off by default (CLAUDE.md rule 7: stock defaults to 1, so most products
    // would otherwise always look "low").
    expect(untracked.data!.trackLowStock).toBe(false);
    untrackedProductId = untracked.data!.id;
  });

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    if (productId) await apiRequest(`/api/products/${productId}`, { method: "DELETE", token: admin.token });
    if (untrackedProductId) {
      await apiRequest(`/api/products/${untrackedProductId}`, { method: "DELETE", token: admin.token });
    }
  });

  it("lists the product in the flattened inventory view", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<StockItem[]>(`/api/inventory?q=${encodeURIComponent(`Vitest Inventory ${nonce}`)}`, {
      token: admin.token,
    });
    expect(res.status).toBe(200);
    const row = res.data!.find((i) => i.id === productId);
    expect(row).toBeDefined();
    // The admin badges low stock off this flag, not off the threshold alone,
    // so the list has to carry it per row.
    expect(row!.trackLowStock).toBe(true);
  });

  // Stock is Admin/Manager territory (CLAUDE.md rule 5) — an Employee doesn't
  // get to browse it either, so the list 403s just like an adjustment does.
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
    const res = await apiRequest<StockAdjustResult>(`/api/inventory/products/${productId}`, {
      method: "PATCH",
      token: admin.token,
      body: { stock: 2 },
    });
    expect(res.status).toBe(200);
    expect(res.data!.stock).toBe(2);
  });

  it("surfaces a tracked product under lowStock once its stock is at/below the threshold", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<StockItem[]>(
      `/api/inventory?lowStock=true&q=${encodeURIComponent(`Vitest Inventory ${nonce}`)}`,
      { token: admin.token }
    );
    expect(res.status).toBe(200);
    const row = res.data!.find((i) => i.id === productId);
    expect(row).toBeDefined();
    // Both halves of what the admin badge now checks: opted in, and at or
    // under the threshold.
    expect(row!.trackLowStock).toBe(true);
    expect(row!.stock).toBeLessThanOrEqual(threshold);
  });

  // Low-stock alerts are opt-in per product: this one sits at stock = 1,
  // well under the threshold, but never asked to be tracked.
  it("omits an untracked product from lowStock even below the threshold", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<StockItem[]>(
      `/api/inventory?lowStock=true&q=${encodeURIComponent(`Vitest Untracked Inventory ${nonce}`)}`,
      { token: admin.token }
    );
    expect(res.status).toBe(200);
    expect(res.data!.some((i) => i.id === untrackedProductId)).toBe(false);
  });

  it("still lists the untracked product in the unfiltered inventory view", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<StockItem[]>(
      `/api/inventory?q=${encodeURIComponent(`Vitest Untracked Inventory ${nonce}`)}`,
      { token: admin.token }
    );
    expect(res.status).toBe(200);
    const row = res.data!.find((i) => i.id === untrackedProductId);
    expect(row).toBeDefined();
    // stock = 1, comfortably under the threshold — but untracked, so the row
    // reports trackLowStock=false and the admin must not badge it as low.
    expect(row!.stock).toBeLessThanOrEqual(threshold);
    expect(row!.trackLowStock).toBe(false);
  });

  it("lets an Admin toggle trackLowStock on an existing product", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<ProductDto>(`/api/products/${untrackedProductId}`, {
      method: "PATCH",
      token: admin.token,
      body: { trackLowStock: true },
    });
    expect(res.status).toBe(200);
    expect(res.data!.trackLowStock).toBe(true);

    const listed = await apiRequest<StockItem[]>(
      `/api/inventory?lowStock=true&q=${encodeURIComponent(`Vitest Untracked Inventory ${nonce}`)}`,
      { token: admin.token }
    );
    expect(listed.data!.some((i) => i.id === untrackedProductId)).toBe(true);

    // Restore, so the two later assertions in this file stay independent of
    // ordering if more are added.
    await apiRequest(`/api/products/${untrackedProductId}`, {
      method: "PATCH",
      token: admin.token,
      body: { trackLowStock: false },
    });
  });

  // Employees can add products but don't manage stock (CLAUDE.md rule 5), so
  // the flag is dropped rather than honoured on their creates.
  it("ignores trackLowStock sent by an Employee on create", async () => {
    const employee = await getSession("EMPLOYEE");
    const admin = await getSession("ADMIN");
    const res = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: employee.token,
      body: {
        name: { ar: `موظف تتبع ${nonce}`, en: `Vitest Employee Track ${nonce}` },
        categoryId,
        basePrice: "40",
        trackLowStock: true,
      },
    });
    expect(res.status).toBe(201);
    expect(res.data!.trackLowStock).toBe(false);
    await apiRequest(`/api/products/${res.data!.id}`, { method: "DELETE", token: admin.token });
  });

  // Tracking is a product-level opt-in, and variants have no flag of their
  // own — every variant row has to report its parent's, or a tracked
  // variant-bearing product would never badge in the admin.
  it("reports the parent product's trackLowStock on every variant row", async () => {
    const admin = await getSession("ADMIN");
    const optionSelections = await twoByTwoOptionSelections(admin.token);
    const created = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: admin.token,
      body: {
        name: { ar: `تتبع متغير ${nonce}`, en: `Vitest Variant Track ${nonce}` },
        categoryId,
        basePrice: "60",
        trackLowStock: true,
        optionSelections,
      },
    });
    expect(created.status).toBe(201);
    const trackedVariantProductId = created.data!.id;

    try {
      const listed = await apiRequest<StockItem[]>(
        `/api/inventory?q=${encodeURIComponent(`Vitest Variant Track ${nonce}`)}`,
        { token: admin.token }
      );
      expect(listed.status).toBe(200);
      const rows = listed.data!.filter((i) => i.productId === trackedVariantProductId);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((i) => i.type === "variant")).toBe(true);
      expect(rows.every((i) => i.trackLowStock === true)).toBe(true);

      // And the mirror case: the untracked simple product's rows stay false.
      const untracked = await apiRequest<StockItem[]>(
        `/api/inventory?q=${encodeURIComponent(`Vitest Untracked Inventory ${nonce}`)}`,
        { token: admin.token }
      );
      const untrackedRows = untracked.data!.filter((i) => i.productId === untrackedProductId);
      expect(untrackedRows.length).toBeGreaterThan(0);
      expect(untrackedRows.every((i) => i.trackLowStock === false)).toBe(true);
    } finally {
      await apiRequest(`/api/products/${trackedVariantProductId}`, { method: "DELETE", token: admin.token });
    }
  });

  it("adjusts a variant's stock via the inventory route", async () => {
    const admin = await getSession("ADMIN");
    const optionSelections = await twoByTwoOptionSelections(admin.token);
    const created = await apiRequest<ProductDto>("/api/products", {
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
      const adjust = await apiRequest<StockAdjustResult>(`/api/inventory/variants/${variantId}`, {
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
