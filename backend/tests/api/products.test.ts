import { afterAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "../support/client";
import { getSession } from "../support/auth";
import { anyCategoryId } from "../support/fixtures";
import { SKU_PAD_LENGTH, SKU_PREFIX } from "@/constants";

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

    const res = await apiRequest<{ id: string; sku: string; barcode: string; hasVariants: boolean }>("/api/products", {
      method: "POST",
      token: admin.token,
      body: { name: { ar: name, en: name }, categoryId, basePrice: "99.99" },
    });

    expect(res.status).toBe(201);
    expect(res.success).toBe(true);
    createdProductIds.push(res.data!.id);

    expect(res.data!.sku).toMatch(skuPattern);
    expect(isValidEan13(res.data!.barcode)).toBe(true);
    expect(res.data!.hasVariants).toBe(false);
  });

  it("hides cost from Employee but returns it to Admin/Manager", async () => {
    const employee = await getSession("EMPLOYEE");
    const manager = await getSession("MANAGER");
    const categoryId = await anyCategoryId(employee.token);
    const name = `Vitest Cost ${uniqueId()}`;

    const created = await apiRequest<{ id: string; cost?: unknown }>("/api/products", {
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

    const asManager = await apiRequest<{ cost: unknown }>(`/api/products/${id}`, { token: manager.token });
    expect(asManager.data).toHaveProperty("cost");
    expect(asManager.data!.cost).toBeNull();
  });
});
