import { afterAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anyCategoryId, twoByTwoOptionSelections } from "@tests/support/fixtures";
import type { ProductDto, ProductLookupDto } from "@tests/types";
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

  it("hides cost from Employee but returns it to Admin/Manager", async () => {
    const employee = await getSession("EMPLOYEE");
    const manager = await getSession("MANAGER");
    const categoryId = await anyCategoryId(employee.token);
    const name = `Vitest Cost ${uniqueId()}`;

    const created = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: employee.token,
      // Employees cannot set cost (CLAUDE.md rule 19) — the backend must
      // silently drop it, not error.
      body: { name: { ar: name, en: name }, categoryId, basePrice: "50", cost: "999" },
    });
    expect(created.status).toBe(201);
    const id = created.data!.id;
    createdProductIds.push(id);

    expect(created.data).not.toHaveProperty("cost");

    const asEmployee = await apiRequest(`/api/products/${id}`, { token: employee.token });
    expect(asEmployee.data).not.toHaveProperty("cost");

    const asManager = await apiRequest<ProductDto>(`/api/products/${id}`, { token: manager.token });
    expect(asManager.data).toHaveProperty("cost");
    expect(asManager.data!.cost).toBeNull();
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

    it("404s on an unknown code and withholds cost from an Employee", async () => {
      const employee = await getSession("EMPLOYEE");
      const manager = await getSession("MANAGER");
      const categoryId = await anyCategoryId(manager.token);
      const name = `Vitest Lookup Cost ${uniqueId()}`;

      const created = await apiRequest<ProductDto>("/api/products", {
        method: "POST",
        token: manager.token,
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
      expect(asManager.data!.product).toHaveProperty("cost");
    });
  });
});
