import { afterAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anyCategoryId, twoByTwoOptionSelections } from "@tests/support/fixtures";
import type { ChangeRequestDto, ProductDto, ProductLookupDto, ProductVariantDto } from "@tests/types";
import { ERROR_CODES, SKU_PAD_LENGTH, SKU_PREFIX } from "@/constants";

const skuPattern = new RegExp(`^${SKU_PREFIX}\\d{${SKU_PAD_LENGTH}}$`);
const ean13Pattern = /^\d{13}$/;

function isValidEan13(barcode: string): boolean {
  if (!ean13Pattern.test(barcode)) return false;
  const digits = barcode.split("").map(Number);
  const checkDigit = digits.pop()!;
  const sum = digits.reduce((acc, digit, i) => acc + (i % 2 === 0 ? digit : digit * 3), 0);
  return (10 - (sum % 10)) % 10 === checkDigit;
}

describe("Products", () => {
  const createdProductIds: string[] = [];

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    for (const id of createdProductIds) {
      await apiRequest(`/api/products/${id}`, { method: "DELETE", token: admin.token });
    }
  });

  it("creates a simple product with an ORG-##### SKU and a valid EAN-13 barcode", async () => {
    const admin = await getSession("ADMIN");
    const categoryId = await anyCategoryId(admin.token);
    const name = `Vitest Simple ${uniqueId()}`;

    const res = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: admin.token,
      body: { name: { ar: name, en: name }, categoryId, basePrice: "99.99" },
    });

    expect(res.status).toBe(201);
    expect(res.success).toBe(true);
    createdProductIds.push(res.data!.id);

    expect(res.data!.sku).toMatch(skuPattern);
    expect(isValidEan13(res.data!.barcode!)).toBe(true);
    expect(res.data!.hasVariants).toBe(false);
  });

  // Cost is ADMIN ONLY (CLAUDE.md rule 19) — a Manager is on the same side of
  // this gate as an Employee: they may run the shop floor, but not read what
  // the owner paid for the stock.
  it("hides cost from an Employee and a Manager, and returns it to an Admin", async () => {
    const employee = await getSession("EMPLOYEE");
    const manager = await getSession("MANAGER");
    const admin = await getSession("ADMIN");
    const categoryId = await anyCategoryId(employee.token);
    const name = `Vitest Cost ${uniqueId()}`;

    const created = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: manager.token,
      // Neither an Employee nor a Manager can SET cost either — the backend
      // must silently drop it, not error.
      body: { name: { ar: name, en: name }, categoryId, basePrice: "50", cost: "999" },
    });
    expect(created.status).toBe(201);
    const id = created.data!.id;
    createdProductIds.push(id);

    expect(created.data).not.toHaveProperty("cost");

    for (const role of ["EMPLOYEE", "MANAGER"] as const) {
      const session = await getSession(role);
      const res = await apiRequest(`/api/products/${id}`, { token: session.token });
      expect(res.data).not.toHaveProperty("cost");
    }

    const asAdmin = await apiRequest<ProductDto>(`/api/products/${id}`, { token: admin.token });
    expect(asAdmin.data).toHaveProperty("cost");
    // Dropped on the way in, so it never got stored.
    expect(asAdmin.data!.cost).toBeNull();
  });

  // CLAUDE.md rule 5 / spec.md: an Employee may fix a product that's already
  // on the shelf — its name, description, category — but not what it sells
  // for. Price lives behind product.editPrice (Admin/Manager), as do stock
  // (inventory.adjust) and visibility (product.hide).
  //
  // Those three are no longer REFUSED, though: they are held for approval
  // (spec.md "Employee change approvals"). The edit is neither applied nor
  // discarded — it waits, attributed, and comes back on the product so the
  // Employee's screen can show it waiting rather than appearing to have
  // dropped what they typed.
  describe("an Employee edits a product but not its price", () => {
    async function createProduct(token: string, label: string): Promise<ProductDto> {
      const categoryId = await anyCategoryId(token);
      const name = `Vitest ${label} ${uniqueId()}`;
      const res = await apiRequest<ProductDto>("/api/products", {
        method: "POST",
        token,
        body: { name: { ar: name, en: name }, categoryId, basePrice: "100", compareAtPrice: "150" },
      });
      expect(res.status).toBe(201);
      createdProductIds.push(res.data!.id);
      return res.data!;
    }

    it("lets an Employee rename a product", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const product = await createProduct(admin.token, "Employee Rename");
      const newName = `Vitest Renamed ${uniqueId()}`;

      const res = await apiRequest<ProductDto>(`/api/products/${product.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { name: { ar: newName, en: newName } },
      });

      expect(res.status).toBe(200);
      expect(res.data!.name.ar).toBe(newName);
    });

    // No longer a refusal (spec.md "Employee change approvals"): the price
    // the Employee typed is HELD, not applied and not thrown away, and comes
    // straight back on the product so their screen can say so.
    it("holds an Employee's price change for approval, leaving the price as it was", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const product = await createProduct(admin.token, "Employee Price");

      const res = await apiRequest<ProductDto>(`/api/products/${product.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { basePrice: "1" },
      });
      expect(res.status).toBe(200);
      const basePriceRequest = res.data!.pendingChanges!.find((c) => c.field === "basePrice");
      expect(basePriceRequest).toBeDefined();
      expect(basePriceRequest!.status).toBe("PENDING");
      expect(basePriceRequest!.oldValue!.value).toBe("100.00");
      expect(basePriceRequest!.newValue!.value).toBe("1.00");
      expect(basePriceRequest!.requestedById).toBe(employee.userId);

      const compare = await apiRequest<ProductDto>(`/api/products/${product.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { compareAtPrice: "5" },
      });
      expect(compare.status).toBe(200);
      // A different field waits independently — superseding is per field.
      expect(compare.data!.pendingChanges!.map((c) => c.field).sort()).toEqual(["basePrice", "compareAtPrice"]);

      // Nothing was applied.
      const after = await apiRequest<ProductDto>(`/api/products/${product.id}`, { token: employee.token });
      expect(Number(after.data!.basePrice)).toBe(100);
      expect(Number(after.data!.compareAtPrice)).toBe(150);
    });

    // The admin form loads the product and posts the whole thing back, so an
    // Employee's "save" carries the price it was already showing. That is not
    // an attempt to re-price anything and must not be refused.
    it("accepts an Employee's edit that resends the price untouched", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const product = await createProduct(admin.token, "Employee Resend");
      const newName = `Vitest Resent ${uniqueId()}`;

      const res = await apiRequest<ProductDto>(`/api/products/${product.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { name: { ar: newName, en: newName }, basePrice: "100", compareAtPrice: "150" },
      });

      expect(res.status).toBe(200);
      expect(res.data!.name.ar).toBe(newName);
    });

    it("holds an Employee's stock and visibility changes on the same route", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const product = await createProduct(admin.token, "Employee Stock");

      const stock = await apiRequest<ProductDto>(`/api/products/${product.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { stock: 99 },
      });
      expect(stock.status).toBe(200);
      const stockRequest = stock.data!.pendingChanges!.find((c) => c.field === "stock");
      expect(stockRequest!.oldValue!.value).toBe(1);
      expect(stockRequest!.newValue!.value).toBe(99);

      const hide = await apiRequest<ProductDto>(`/api/products/${product.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { isActive: false },
      });
      expect(hide.status).toBe(200);
      const hideRequest = hide.data!.pendingChanges!.find((c) => c.field === "isActive");
      expect(hideRequest!.oldValue!.value).toBe(true);
      expect(hideRequest!.newValue!.value).toBe(false);

      // Held, not applied: the piece is still on the shelf, still visible.
      const after = await apiRequest<ProductDto>(`/api/products/${product.id}`, { token: employee.token });
      expect(after.data!.stock).toBe(1);
      expect(after.data!.isActive).toBe(true);
    });

    // A variant's priceOverride IS what that combination sells for, so the
    // same gate has to hold there — otherwise the product-level check is just
    // a detour.
    it("holds an Employee's change to a variant's price override", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const categoryId = await anyCategoryId(admin.token);
      const optionSelections = await twoByTwoOptionSelections(admin.token);
      const name = `Vitest Employee Variant Price ${uniqueId()}`;

      const created = await apiRequest<ProductDto>("/api/products", {
        method: "POST",
        token: admin.token,
        body: { name: { ar: name, en: name }, categoryId, basePrice: "100", optionSelections },
      });
      expect(created.status).toBe(201);
      createdProductIds.push(created.data!.id);
      const variant = created.data!.variants[0];

      const res = await apiRequest<ProductVariantDto & { pendingChanges: ChangeRequestDto[] }>(
        `/api/products/${created.data!.id}/variants/${variant.id}`,
        { method: "PATCH", token: employee.token, body: { priceOverride: "1" } }
      );
      expect(res.status).toBe(200);
      const request = res.data!.pendingChanges.find((c) => c.field === "priceOverride");
      expect(request!.entityType).toBe("Variant");
      expect(request!.entityId).toBe(variant.id);
      expect(request!.newValue!.value).toBe("1.00");

      // The variant still sells for what it did.
      const after = await apiRequest<ProductDto>(`/api/products/${created.data!.id}`, { token: admin.token });
      expect(after.data!.variants.find((v) => v.id === variant.id)!.priceOverride).toBeNull();
    });

    it("still lets a Manager change the price", async () => {
      const admin = await getSession("ADMIN");
      const manager = await getSession("MANAGER");
      const product = await createProduct(admin.token, "Manager Price");

      const res = await apiRequest<ProductDto>(`/api/products/${product.id}`, {
        method: "PATCH",
        token: manager.token,
        body: { basePrice: "123.45" },
      });

      expect(res.status).toBe(200);
      expect(Number(res.data!.basePrice)).toBe(123.45);
    });
  });

  // GET /api/products/lookup — what one POS scan resolves to. The POS puts
  // the returned item straight into the cart, so "which variant" has to be
  // unambiguous, not left to the caller to work out.
  describe("lookup by scanned code", () => {
    it("resolves a simple product's own barcode, and its SKU", async () => {
      const employee = await getSession("EMPLOYEE");
      const categoryId = await anyCategoryId(employee.token);
      const name = `Vitest Lookup ${uniqueId()}`;

      const created = await apiRequest<ProductDto>("/api/products", {
        method: "POST",
        token: employee.token,
        body: { name: { ar: name, en: name }, categoryId, basePrice: "80" },
      });
      expect(created.status).toBe(201);
      const product = created.data!;
      createdProductIds.push(product.id);

      for (const code of [product.barcode!, product.sku!]) {
        const res = await apiRequest<ProductLookupDto>(`/api/products/lookup?code=${encodeURIComponent(code)}`, {
          token: employee.token,
        });
        expect(res.status).toBe(200);
        expect(res.data!.product.id).toBe(product.id);
        // A simple product IS the purchasable item — there is no variant.
        expect(res.data!.variant).toBeNull();
      }
    });

    it("resolves a variant's barcode to that exact variant", async () => {
      const admin = await getSession("ADMIN");
      const categoryId = await anyCategoryId(admin.token);
      const optionSelections = await twoByTwoOptionSelections(admin.token);
      const name = `Vitest Lookup Variant ${uniqueId()}`;

      const created = await apiRequest<ProductDto>("/api/products", {
        method: "POST",
        token: admin.token,
        body: { name: { ar: name, en: name }, categoryId, basePrice: "120", optionSelections },
      });
      expect(created.status).toBe(201);
      const product = created.data!;
      createdProductIds.push(product.id);

      const target = product.variants[1];
      const res = await apiRequest<ProductLookupDto>(
        `/api/products/lookup?code=${encodeURIComponent(target.barcode!)}`,
        { token: admin.token }
      );

      expect(res.status).toBe(200);
      expect(res.data!.product.id).toBe(product.id);
      expect(res.data!.variant?.id).toBe(target.id);
    });

    it("404s on an unknown code and withholds cost from everyone below Admin", async () => {
      const employee = await getSession("EMPLOYEE");
      const manager = await getSession("MANAGER");
      const admin = await getSession("ADMIN");
      const categoryId = await anyCategoryId(manager.token);
      const name = `Vitest Lookup Cost ${uniqueId()}`;

      const created = await apiRequest<ProductDto>("/api/products", {
        method: "POST",
        token: admin.token,
        body: { name: { ar: name, en: name }, categoryId, basePrice: "60", cost: "25" },
      });
      const product = created.data!;
      createdProductIds.push(product.id);

      const missing = await apiRequest(`/api/products/lookup?code=no-such-code-${uniqueId()}`, {
        token: employee.token,
      });
      expect(missing.status).toBe(404);
      expect(missing.error?.code).toBe(ERROR_CODES.PRODUCT_NOT_FOUND);

      // Scanning must not become a side door onto a sensitive field
      // (CLAUDE.md rule 19) — the same gate as every other product read.
      const asEmployee = await apiRequest<ProductLookupDto>(
        `/api/products/lookup?code=${encodeURIComponent(product.barcode!)}`,
        { token: employee.token }
      );
      expect(asEmployee.status).toBe(200);
      expect(asEmployee.data!.product).not.toHaveProperty("cost");

      const asManager = await apiRequest<ProductLookupDto>(
        `/api/products/lookup?code=${encodeURIComponent(product.barcode!)}`,
        { token: manager.token }
      );
      expect(asManager.data!.product).not.toHaveProperty("cost");

      const asAdmin = await apiRequest<ProductLookupDto>(
        `/api/products/lookup?code=${encodeURIComponent(product.barcode!)}`,
        { token: admin.token }
      );
      expect(asAdmin.data!.product).toHaveProperty("cost");
      expect(Number(asAdmin.data!.product.cost)).toBe(25);
    });
  });
});
