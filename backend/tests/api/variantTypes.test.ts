import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "@tests/support/client";
import { fetchPermissionMatrix } from "@tests/support/permissions";
import { getSession } from "@tests/support/auth";
import { anyCategoryId } from "@tests/support/fixtures";
import type { ProductDto, VariantOptionValueDto, VariantTypeDto } from "@tests/types";

// The global option lists (Color, Size, Number, …) are shared by every
// product, so what a role may do to them is split in two: adding is
// variantType.create — an Employee adds products, and "Material / Emerald
// isn't in the list yet" is a normal part of that (spec.md "Inline add") —
// while renaming or removing an existing entry is variantType.manage,
// because it reaches every product using that value at once (CLAUDE.md
// rule 2) and belongs with Admin/Manager.
describe("Variant types", () => {
  const nonce = uniqueId();
  const createdProductIds: string[] = [];
  // Created once, by the Employee, and then reused: the API has no delete for
  // option types, so each run appends exactly one type rather than dropping
  // throwaway values into the seeded Color/Size lists.
  let employeeTypeId: string;
  let createStatus: number;
  let createdType: VariantTypeDto | undefined;

  beforeAll(async () => {
    const employee = await getSession("EMPLOYEE");
    const res = await apiRequest<VariantTypeDto>("/api/variant-types", {
      method: "POST",
      token: employee.token,
      body: { name: { ar: `خامة ${nonce}`, en: `Vitest Material ${nonce}` } },
    });
    createStatus = res.status;
    createdType = res.data;
    employeeTypeId = res.data?.id ?? "";
  });

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    for (const id of createdProductIds) {
      await apiRequest(`/api/products/${id}`, { method: "DELETE", token: admin.token });
    }
  });

  it("lets an Employee create a new option type", async () => {
    // The type itself is created in beforeAll — the tests below build on it,
    // and the API has no delete, so it's made once per run rather than once
    // per test. This asserts the create was accepted and really landed in the
    // shared list every product reads from.
    expect(createStatus).toBe(201);
    expect(createdType!.slug).toBeTruthy();

    const employee = await getSession("EMPLOYEE");
    const list = await apiRequest<VariantTypeDto[]>("/api/variant-types", { token: employee.token });
    expect(list.status).toBe(200);
    expect(list.data!.some((type) => type.id === employeeTypeId)).toBe(true);
  });

  it("lets an Employee add a value to an existing type", async () => {
    const employee = await getSession("EMPLOYEE");
    const res = await apiRequest<VariantOptionValueDto>(`/api/variant-types/${employeeTypeId}/values`, {
      method: "POST",
      token: employee.token,
      body: { value: { ar: `زمردي ${nonce}`, en: `Emerald ${nonce}` } },
    });

    expect(res.status).toBe(201);
    expect(res.data!.id).toBeTruthy();
  });

  // The whole point of the create permission: an Employee adding a product
  // whose option isn't in the list yet can add it and carry straight on to
  // the product itself, without waiting for a manager.
  it("lets an Employee build a product from a value they just added", async () => {
    const employee = await getSession("EMPLOYEE");
    const admin = await getSession("ADMIN");
    const categoryId = await anyCategoryId(employee.token);

    const added = await apiRequest<VariantOptionValueDto>(`/api/variant-types/${employeeTypeId}/values`, {
      method: "POST",
      token: employee.token,
      body: { value: { ar: `كتان ${nonce}`, en: `Linen ${nonce}` } },
    });
    expect(added.status).toBe(201);

    const name = `Vitest Inline Add ${nonce}`;
    const created = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: employee.token,
      body: {
        name: { ar: name, en: name },
        categoryId,
        basePrice: "70",
        optionSelections: [{ variantTypeId: employeeTypeId, valueIds: [added.data!.id] }],
      },
    });

    expect(created.status).toBe(201);
    createdProductIds.push(created.data!.id);
    expect(created.data!.hasVariants).toBe(true);
    expect(created.data!.variants).toHaveLength(1);

    // Referenced by id, never copied (CLAUDE.md rule 2).
    expect(created.data!.variants[0].values[0].id).toBe(added.data!.id);

    // And the type an Employee created is a normal global type, usable by
    // anyone else from then on.
    const asAdmin = await apiRequest<VariantTypeDto[]>("/api/variant-types", { token: admin.token });
    expect(asAdmin.data!.some((type) => type.id === employeeTypeId)).toBe(true);
  });

  // Renaming and deleting are Admin/Manager only. There is no rename/delete
  // endpoint yet (the API exposes GET + the two creates), so this pins the
  // rule at the layer that does exist: an Employee holds the additive
  // permission and not the destructive one, and whatever rename/delete route
  // is added later has to gate on variantType.manage — the same `can()` check
  // requirePermission runs — for it to be closed to them.
  //
  // Asserted against the rules the API says are IN FORCE, not against the
  // constant they are seeded from: both of these are configurable per shop
  // now (spec.md "Editable role permissions"), and the state being asserted
  // here is the baseline this suite writes for itself in tests/setup.ts.
  it("keeps renaming and removing existing types out of an Employee's reach", async () => {
    const matrix = await fetchPermissionMatrix();

    expect(matrix.roles.EMPLOYEE).toContain("variantType.create");
    expect(matrix.roles.EMPLOYEE).not.toContain("variantType.manage");

    for (const role of ["ADMIN", "MANAGER"] as const) {
      expect(matrix.roles[role]).toContain("variantType.create");
      expect(matrix.roles[role]).toContain("variantType.manage");
    }
  });
});
