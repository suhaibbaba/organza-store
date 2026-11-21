import { afterAll, describe, expect, it } from "vitest";
import { API_BASE_URL, API_ORIGIN, apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anyCategoryId, twoByTwoOptionSelections } from "@tests/support/fixtures";
import { createSellableProduct, readStock } from "@tests/support/orders";
import {
  approveChange,
  cancelChange,
  changeRequestsFor,
  listChangeRequests,
  pendingChangeFor,
  rejectChange,
} from "@tests/support/changeRequests";
import { createExpense, expenseCategoryId } from "@tests/support/cash";
import type { ChangeRequestCountDto, ChangeRequestDto, ExpenseDto, OrderDto, ProductDto } from "@tests/types";
import { ERROR_CODES } from "@/constants";

// Change approvals: the value must not move, the request carries old and new, only an Admin decides; live API, so never assert totals.

// The smallest valid PNG: one transparent pixel, enough for sharp's sizes.
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

describe("Change requests", () => {
  const createdProductIds: string[] = [];
  const createdExpenseIds: string[] = [];

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    for (const id of createdProductIds) {
      await apiRequest(`/api/products/${id}`, { method: "DELETE", token: admin.token });
    }
    for (const id of createdExpenseIds) {
      await apiRequest(`/api/expenses/${id}`, { method: "DELETE", token: admin.token });
    }
  });

  async function product(token: string, label: string, body: Record<string, unknown> = {}): Promise<ProductDto> {
    const categoryId = await anyCategoryId(token);
    const name = `Vitest CR ${label} ${uniqueId()}`;
    const res = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token,
      body: { name: { ar: name, en: name }, categoryId, basePrice: "100", ...body },
    });
    expect(res.status).toBe(201);
    createdProductIds.push(res.data!.id);
    return res.data!;
  }

  describe("the five gated actions", () => {
    it("holds a price change, and says so on the product it was asked about", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const created = await product(admin.token, "Price");

      const res = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { basePrice: "7.50" },
      });
      expect(res.status).toBe(200);

      const request = res.data!.pendingChanges!.find((c) => c.field === "basePrice")!;
      expect(request.entityType).toBe("Product");
      expect(request.entityId).toBe(created.id);
      expect(request.status).toBe("PENDING");
      expect(request.oldValue).toEqual({ kind: "money", value: "100.00" });
      expect(request.newValue).toEqual({ kind: "money", value: "7.50" });
      // Who asked, so the approval screen can say it without a second lookup.
      expect(request.requestedBy?.id).toBe(employee.userId);
      expect(request.decidedBy).toBeNull();
      // A snapshot of what it is about, so the screen reads without one either.
      expect(request.entityLabel?.ar).toContain("Vitest CR Price");
      expect(request.productId).toBe(created.id);

      expect(
        Number((await apiRequest<ProductDto>(`/api/products/${created.id}`, { token: admin.token })).data!.basePrice),
      ).toBe(100);
    });

    it("holds a manual stock change", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const created = await product(admin.token, "Stock", { stock: "5" });

      const res = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { stock: 42 },
      });
      expect(res.status).toBe(200);

      const request = res.data!.pendingChanges!.find((c) => c.field === "stock")!;
      expect(request.oldValue).toEqual({ kind: "count", value: 5 });
      expect(request.newValue).toEqual({ kind: "count", value: 42 });
      expect(await readStock(admin.token, created.id)).toBe(5);
    });

    it("holds hiding a product, and unhiding it again", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const created = await product(admin.token, "Hide");

      const hide = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { isActive: false },
      });
      expect(hide.status).toBe(200);
      expect(hide.data!.isActive).toBe(true);
      expect(hide.data!.pendingChanges!.find((c) => c.field === "isActive")!.newValue).toEqual({
        kind: "flag",
        value: false,
      });

      // The gate holds both ways: an Employee cannot unhide a product either.
      const hidden = await product(admin.token, "Unhide", { isActive: false });
      const show = await apiRequest<ProductDto>(`/api/products/${hidden.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { isActive: true },
      });
      expect(show.status).toBe(200);
      expect(show.data!.isActive).toBe(false);
      expect(show.data!.pendingChanges!.find((c) => c.field === "isActive")!.newValue!.value).toBe(true);
    });

    it("holds adding to a product's variant set, and removing from it", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const optionSelections = await twoByTwoOptionSelections(admin.token);
      const created = await product(admin.token, "VariantSet");

      // Adding: 2x2 = four combinations asked for, none created.
      const add = await apiRequest<ProductDto>(`/api/products/${created.id}/variants/generate`, {
        method: "POST",
        token: employee.token,
        body: { optionSelections },
      });
      // 200, not 201: nothing was created.
      expect(add.status).toBe(200);
      expect(add.data!.variants).toHaveLength(0);

      const addRequest = add.data!.pendingChanges!.find((c) => c.field === "variantSet")!;
      expect(addRequest.newValue!.detail!.action).toBe("add");
      expect(addRequest.newValue!.value).toBe(4);
      expect(addRequest.newValue!.detail!.variants).toHaveLength(4);
      // Option value ids are stored, never their current names (rule 2).
      expect(addRequest.newValue!.detail!.optionSelections).toHaveLength(2);

      // Removing: an Employee cannot pull a combination out either.
      const withVariants = await product(admin.token, "VariantRemove", { optionSelections });
      const variant = withVariants.variants[0];
      const remove = await apiRequest<{ id: string; deleted: boolean; pendingChange: ChangeRequestDto }>(
        `/api/products/${withVariants.id}/variants/${variant.id}`,
        { method: "DELETE", token: employee.token },
      );
      expect(remove.status).toBe(202);
      expect(remove.data!.deleted).toBe(false);
      expect(remove.data!.pendingChange.newValue!.detail!.action).toBe("remove");
      expect(remove.data!.pendingChange.newValue!.detail!.variantId).toBe(variant.id);

      const after = await apiRequest<ProductDto>(`/api/products/${withVariants.id}`, { token: admin.token });
      expect(after.data!.variants).toHaveLength(4);
    });

    it("holds deleting a photo, and the photo stays in the gallery", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const created = await product(admin.token, "Photo");

      const form = new FormData();
      form.append("productId", created.id);
      form.append("file", new Blob([new Uint8Array(ONE_PIXEL_PNG)], { type: "image/png" }), "pixel.png");
      const uploaded = await fetch(`${API_BASE_URL}/api/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${admin.token}`, Origin: API_ORIGIN },
        body: form,
      });
      expect(uploaded.status).toBe(201);
      const image = ((await uploaded.json()) as { data: { id: string } }).data;

      const res = await apiRequest<{ id: string; deleted: boolean; pendingChange: ChangeRequestDto }>(
        `/api/images/${image.id}`,
        { method: "DELETE", token: employee.token },
      );
      expect(res.status).toBe(202);
      expect(res.data!.deleted).toBe(false);
      expect(res.data!.pendingChange.entityType).toBe("ProductImage");
      expect(res.data!.pendingChange.entityId).toBe(image.id);
      expect(res.data!.pendingChange.newValue).toEqual({ kind: "deletion", value: true });
      // The photo's own gallery is where the Employee sees it waiting.
      expect(res.data!.pendingChange.productId).toBe(created.id);

      const reread = await apiRequest<ProductDto>(`/api/products/${created.id}`, { token: admin.token });
      expect(reread.data!.images.map((i) => i.id)).toContain(image.id);
    });

    // Admin and Manager hold the permissions, so their edits apply at once and file nothing.
    it("applies a Manager's price change immediately, with nothing left waiting", async () => {
      const admin = await getSession("ADMIN");
      const manager = await getSession("MANAGER");
      const created = await product(admin.token, "ManagerPrice");

      const res = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: manager.token,
        body: { basePrice: "77", stock: 9, isActive: false },
      });
      expect(res.status).toBe(200);
      expect(Number(res.data!.basePrice)).toBe(77);
      expect(res.data!.stock).toBe(9);
      expect(res.data!.isActive).toBe(false);
      expect(res.data!.pendingChanges).toEqual([]);
    });
  });

  describe("superseding", () => {
    it("replaces the older pending request for the same field rather than queueing", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const created = await product(admin.token, "Supersede");

      const first = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { basePrice: "10" },
      });
      const firstId = first.data!.pendingChanges!.find((c) => c.field === "basePrice")!.id;

      const second = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { basePrice: "20" },
      });
      const held = second.data!.pendingChanges!.filter((c) => c.field === "basePrice");

      // ONE request, carrying the newer value. Not two, and not the old one.
      expect(held).toHaveLength(1);
      expect(held[0].id).toBe(firstId);
      expect(held[0].newValue!.value).toBe("20.00");
      // ...and the old value it is measured against is still the stored one.
      expect(held[0].oldValue!.value).toBe("100.00");

      const listed = await listChangeRequests(
        admin.token,
        `?status=PENDING&entityType=Product&entityId=${created.id}&pageSize=100`,
      );
      expect(listed.data!.filter((c) => c.field === "basePrice")).toHaveLength(1);

      // Approving the survivor applies the newer figure; the stale one is gone.
      await approveChange(admin.token, held[0].id);
      const after = await apiRequest<ProductDto>(`/api/products/${created.id}`, { token: admin.token });
      expect(Number(after.data!.basePrice)).toBe(20);
    });

    it("lets a decided request be followed by a fresh one on the same field", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const created = await product(admin.token, "AfterDecision");

      const first = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { basePrice: "30" },
      });
      const firstId = first.data!.pendingChanges!.find((c) => c.field === "basePrice")!.id;
      await rejectChange(admin.token, firstId);

      const second = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { basePrice: "40" },
      });
      const held = second.data!.pendingChanges!.filter((c) => c.field === "basePrice");
      // A new row: the decided one keeps its decision, its pending slot freed.
      expect(held).toHaveLength(1);
      expect(held[0].id).not.toBe(firstId);
    });
  });

  describe("deciding", () => {
    async function heldPrice(label: string, price = "5") {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const created = await product(admin.token, label);
      const res = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { basePrice: price },
      });
      return { productId: created.id, request: res.data!.pendingChanges!.find((c) => c.field === "basePrice")! };
    }

    it("refuses an Employee and a Manager, and accepts an Admin", async () => {
      const employee = await getSession("EMPLOYEE");
      const manager = await getSession("MANAGER");
      const admin = await getSession("ADMIN");
      const { productId, request } = await heldPrice("DecideGate", "5");

      for (const token of [employee.token, manager.token]) {
        const res = await approveChange(token, request.id);
        expect(res.status).toBe(403);
        expect(res.error?.code).toBe(ERROR_CODES.FORBIDDEN);
      }
      // Rejecting is the same gate, not a softer one.
      const rejectAttempt = await rejectChange(manager.token, request.id);
      expect(rejectAttempt.status).toBe(403);

      // Still untouched after all that.
      const before = await apiRequest<ProductDto>(`/api/products/${productId}`, { token: admin.token });
      expect(Number(before.data!.basePrice)).toBe(100);

      const approved = await approveChange(admin.token, request.id);
      expect(approved.status).toBe(200);
      expect(approved.data!.status).toBe("APPROVED");
      expect(approved.data!.decidedBy?.id).toBe(admin.userId);
      expect(approved.data!.decidedAt).not.toBeNull();
    });

    it("applies the change on approval, atomically, and clears it from the product", async () => {
      const admin = await getSession("ADMIN");
      const { productId, request } = await heldPrice("Approve", "12.34");

      const approved = await approveChange(admin.token, request.id, "متفق عليه");
      expect(approved.status).toBe(200);
      expect(approved.data!.decisionNote).toBe("متفق عليه");

      const after = await apiRequest<ProductDto>(`/api/products/${productId}`, { token: admin.token });
      expect(Number(after.data!.basePrice)).toBe(12.34);
      expect(after.data!.pendingChanges).toEqual([]);
    });

    it("discards the change on rejection, leaving the value exactly as it was", async () => {
      const admin = await getSession("ADMIN");
      const { productId, request } = await heldPrice("Reject", "1");

      const rejected = await rejectChange(admin.token, request.id, "السعر غلط");
      expect(rejected.status).toBe(200);
      expect(rejected.data!.status).toBe("REJECTED");
      expect(rejected.data!.decisionNote).toBe("السعر غلط");

      const after = await apiRequest<ProductDto>(`/api/products/${productId}`, { token: admin.token });
      expect(Number(after.data!.basePrice)).toBe(100);
      expect(after.data!.pendingChanges).toEqual([]);

      // Deciding it a second time would overwrite who decided what.
      const again = await approveChange(admin.token, request.id);
      expect(again.status).toBe(409);
      expect(again.error?.code).toBe(ERROR_CODES.CHANGE_REQUEST_NOT_PENDING);
    });

    it("applies an approved variant-set addition, generating the combinations", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const optionSelections = await twoByTwoOptionSelections(admin.token);
      const created = await product(admin.token, "ApproveVariants");

      const asked = await apiRequest<ProductDto>(`/api/products/${created.id}/variants/generate`, {
        method: "POST",
        token: employee.token,
        body: { optionSelections },
      });
      const request = asked.data!.pendingChanges!.find((c) => c.field === "variantSet")!;

      expect((await approveChange(admin.token, request.id)).status).toBe(200);

      const after = await apiRequest<ProductDto>(`/api/products/${created.id}`, { token: admin.token });
      expect(after.data!.variants).toHaveLength(4);
      // Generated for real: every combination has its own SKU and barcode.
      expect(new Set(after.data!.variants.map((v) => v.sku)).size).toBe(4);
      expect(after.data!.variants.every((v) => Boolean(v.barcode))).toBe(true);
    });

    it("creates new combinations with the opening stock asked for, and the default for the rest", async () => {
      const admin = await getSession("ADMIN");
      const optionSelections = await twoByTwoOptionSelections(admin.token);
      const created = await product(admin.token, "ComboStock");
      const first = optionSelections.map((selection) => selection.valueIds[0]!);

      const added = await apiRequest<ProductDto>(`/api/products/${created.id}/variants/generate`, {
        method: "POST",
        token: admin.token,
        body: { optionSelections, comboStocks: [{ valueIds: [...first].reverse(), stock: 7 }] },
      });
      expect(added.status).toBe(201);

      const stocks = added.data!.variants.map((variant) => ({
        stock: variant.stock,
        chosen: variant.values.every((value) => first.includes(value.id)),
      }));
      expect(stocks.filter((row) => row.chosen).map((row) => row.stock)).toEqual([7]);
      expect(stocks.filter((row) => !row.chosen).every((row) => row.stock === 1)).toBe(true);
    });

    it("carries the asked-for opening stock through an approved variant-set addition", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const optionSelections = await twoByTwoOptionSelections(admin.token);
      const created = await product(admin.token, "ApproveComboStock");
      const first = optionSelections.map((selection) => selection.valueIds[0]!);

      const asked = await apiRequest<ProductDto>(`/api/products/${created.id}/variants/generate`, {
        method: "POST",
        token: employee.token,
        body: { optionSelections, comboStocks: [{ valueIds: first, stock: 5 }] },
      });
      const request = asked.data!.pendingChanges!.find((c) => c.field === "variantSet")!;
      expect((await approveChange(admin.token, request.id)).status).toBe(200);

      const after = await apiRequest<ProductDto>(`/api/products/${created.id}`, { token: admin.token });
      const chosen = after.data!.variants.find((variant) => variant.values.every((value) => first.includes(value.id)));
      expect(chosen?.stock).toBe(5);
    });

    it("applies an approved photo deletion, and the photo is gone", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const created = await product(admin.token, "ApprovePhoto");

      const form = new FormData();
      form.append("productId", created.id);
      form.append("file", new Blob([new Uint8Array(ONE_PIXEL_PNG)], { type: "image/png" }), "pixel.png");
      const uploaded = await fetch(`${API_BASE_URL}/api/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${admin.token}`, Origin: API_ORIGIN },
        body: form,
      });
      const image = ((await uploaded.json()) as { data: { id: string } }).data;

      const asked = await apiRequest<{ pendingChange: ChangeRequestDto }>(`/api/images/${image.id}`, {
        method: "DELETE",
        token: employee.token,
      });
      expect((await approveChange(admin.token, asked.data!.pendingChange.id)).status).toBe(200);

      const after = await apiRequest<ProductDto>(`/api/products/${created.id}`, { token: admin.token });
      expect(after.data!.images.map((i) => i.id)).not.toContain(image.id);
    });

    it("404s on a request that does not exist", async () => {
      const admin = await getSession("ADMIN");
      const res = await approveChange(admin.token, "no-such-change-request");
      expect(res.status).toBe(404);
      expect(res.error?.code).toBe(ERROR_CODES.CHANGE_REQUEST_NOT_FOUND);
    });
  });

  describe("the list", () => {
    it("shows an Employee only their own, and an Admin everyone's", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const created = await product(admin.token, "Scope");

      const filed = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { basePrice: "3" },
      });
      const requestId = filed.data!.pendingChanges!.find((c) => c.field === "basePrice")!.id;

      const asEmployee = await listChangeRequests(employee.token, "?status=PENDING&pageSize=100");
      expect(asEmployee.status).toBe(200);
      // Narrowed on the backend, not in the UI: nothing they did not ask for.
      expect(asEmployee.data!.every((c) => c.requestedById === employee.userId)).toBe(true);
      expect(asEmployee.data!.map((c) => c.id)).toContain(requestId);

      const asAdmin = await listChangeRequests(admin.token, `?status=PENDING&entityId=${created.id}&pageSize=100`);
      expect(asAdmin.data!.map((c) => c.id)).toContain(requestId);

      // ...and reading someone else's directly is refused too.
      const manager = await getSession("MANAGER");
      const direct = await apiRequest(`/api/change-requests/${requestId}`, { token: manager.token });
      expect(direct.status).toBe(403);
    });

    it("counts what is waiting, for the badge in the navigation", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const created = await product(admin.token, "Count");

      const before = await apiRequest<ChangeRequestCountDto>("/api/change-requests/count", {
        token: admin.token,
      });
      expect(before.status).toBe(200);

      await apiRequest(`/api/products/${created.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { basePrice: "2" },
      });

      const after = await apiRequest<ChangeRequestCountDto>("/api/change-requests/count", { token: admin.token });
      expect(after.data!.pending).toBe(before.data!.pending + 1);
    });

    it("paginates, like every other list", async () => {
      const admin = await getSession("ADMIN");
      const res = await listChangeRequests(admin.token, "?page=1&pageSize=1");
      expect(res.status).toBe(200);
      expect(res.meta?.pageSize).toBe(1);
      expect(res.data!.length).toBeLessThanOrEqual(1);
    });
  });

  // A decided request carries the decision really made, and each tab lists only its own state.
  describe("status, as reported", () => {
    async function decidedPair() {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");

      async function askedPrice(label: string, price: string) {
        const created = await product(admin.token, label);
        const res = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
          method: "PATCH",
          token: employee.token,
          body: { basePrice: price },
        });
        return { productId: created.id, id: res.data!.pendingChanges!.find((c) => c.field === "basePrice")!.id };
      }

      const rejected = await askedPrice("StatusRejected", "11");
      const approved = await askedPrice("StatusApproved", "22");
      expect((await rejectChange(admin.token, rejected.id, "غالي")).status).toBe(200);
      expect((await approveChange(admin.token, approved.id)).status).toBe(200);
      return { admin, employee, rejected, approved };
    }

    /** One Employee price request, still waiting on a decision. */
    async function heldPriceForDecision(label: string) {
      const admin = await getSession("ADMIN");
      const manager = await getSession("MANAGER");
      const employee = await getSession("EMPLOYEE");
      const created = await product(admin.token, label);
      const res = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { basePrice: "8.25" },
      });
      expect(res.status).toBe(200);
      return {
        admin,
        manager,
        employee,
        request: res.data!.pendingChanges!.find((c) => c.field === "basePrice")!,
      };
    }

    it("reports a rejected request as REJECTED and an approved one as APPROVED, however it is read", async () => {
      const { admin, rejected, approved } = await decidedPair();

      // Read one at a time...
      for (const [id, status] of [
        [rejected.id, "REJECTED"],
        [approved.id, "APPROVED"],
      ] as const) {
        const single = await apiRequest<ChangeRequestDto>(`/api/change-requests/${id}`, { token: admin.token });
        expect(single.status).toBe(200);
        expect(single.data!.status).toBe(status);
      }

      // The card renders whatever this row says.
      const listed = await changeRequestsFor(admin.token, "Product", rejected.productId, "basePrice");
      expect(listed).toHaveLength(1);
      expect(listed[0].status).toBe("REJECTED");
      // Its decision is on it, so the card needs no second lookup to say who.
      expect(listed[0].decidedBy?.id).toBe(admin.userId);
      expect(listed[0].decisionNote).toBe("غالي");
      // A refusal changes the request only: the asked value stays on the row, the price never moved.
      expect(listed[0].newValue).toEqual({ kind: "money", value: "11.00" });
      const untouched = await apiRequest<ProductDto>(`/api/products/${rejected.productId}`, { token: admin.token });
      expect(Number(untouched.data!.basePrice)).toBe(100);
    });

    it("lists a request under its own status tab only", async () => {
      const { admin, rejected, approved } = await decidedPair();

      // Every row a status tab returns must be in that state, or a card contradicts its heading.
      for (const status of ["PENDING", "APPROVED", "REJECTED"] as const) {
        const tab = await listChangeRequests(admin.token, `?status=${status}&pageSize=100`);
        expect(tab.status).toBe(200);
        expect(tab.data!.every((c) => c.status === status)).toBe(true);
      }

      // Scoped to their own product, so other requests on the live database cannot sway this.
      for (const { id, productId, belongs } of [
        { ...rejected, belongs: "REJECTED" },
        { ...approved, belongs: "APPROVED" },
      ] as const) {
        for (const status of ["PENDING", "APPROVED", "REJECTED"] as const) {
          const tab = await listChangeRequests(
            admin.token,
            `?status=${status}&entityType=Product&entityId=${productId}&pageSize=100`,
          );
          expect(tab.data!.map((c) => c.id).includes(id)).toBe(status === belongs);
        }
      }
    });

    it("records exactly one decision, and never a second row describing it", async () => {
      const { admin, manager, request } = await heldPriceForDecision("OneDecision");

      // Before: nothing decided.
      expect(request.status).toBe("PENDING");
      expect(request.decidedById).toBeNull();
      expect(request.decidedAt).toBeNull();

      const rejected = await rejectChange(admin.token, request.id, "لا");
      expect(rejected.status).toBe(200);
      const decidedById = rejected.data!.decidedById;
      const decidedAt = rejected.data!.decidedAt;
      expect(decidedById).toBe(admin.userId);
      expect(decidedAt).not.toBeNull();

      // Deciding again is refused rather than overwriting who agreed to what.
      expect((await approveChange(admin.token, request.id)).status).toBe(409);
      expect((await rejectChange(manager.token, request.id)).status).toBe(403);

      const after = await apiRequest<ChangeRequestDto>(`/api/change-requests/${request.id}`, {
        token: admin.token,
      });
      expect(after.data!.status).toBe("REJECTED");
      expect(after.data!.decidedById).toBe(decidedById);
      expect(after.data!.decidedAt).toBe(decidedAt);

      // One row carries the refusal, never duplicates under two deciders.
      const rows = await changeRequestsFor(admin.token, "Product", request.entityId, "basePrice");
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(request.id);
    });

    // Every expense request asks for APPROVED, so only the status can say a refused one was refused.
    it("marks a refused expense's request REJECTED, once, with the Admin who refused it", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const categoryId = await expenseCategoryId(employee.token);

      const created = await createExpense(employee.token, {
        categoryId,
        amount: "63.25",
        note: `Vitest CR expense ${uniqueId()}`,
        paidInCash: true,
      });
      expect(created.status).toBe(201);
      createdExpenseIds.push(created.data!.id);
      expect(created.data!.approvalStatus).toBe("PENDING");

      const asked = (await pendingChangeFor(admin.token, "Expense", created.data!.id))!;
      expect(asked.status).toBe("PENDING");
      expect(asked.newValue).toEqual({ kind: "approval", value: "APPROVED" });

      const refused = await rejectChange(admin.token, asked.id, "مسجّلة مرتين");
      expect(refused.status).toBe(200);
      expect(refused.data!.status).toBe("REJECTED");
      expect(refused.data!.decidedBy?.id).toBe(admin.userId);

      // One REJECTED row for this expense, decided by the Admin.
      const rows = await changeRequestsFor(admin.token, "Expense", created.data!.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("REJECTED");
      expect(rows[0].decidedById).toBe(admin.userId);

      // The expense itself agrees, so the two screens showing it cannot disagree.
      const expense = await apiRequest<ExpenseDto>(`/api/expenses/${created.data!.id}`, { token: admin.token });
      expect(expense.data!.approvalStatus).toBe("REJECTED");
      expect(expense.data!.approvedBy?.id).toBe(admin.userId);
    });

    // Deciding is changeRequest.approve (Admin); a Manager's expense.approve covers only their own spending.
    it("refuses every non-Admin, on both endpoints, and stores no decider when it does", async () => {
      const admin = await getSession("ADMIN");
      const manager = await getSession("MANAGER");
      const employee = await getSession("EMPLOYEE");
      const { request } = await heldPriceForDecision("NonAdminDecider");

      for (const token of [manager.token, employee.token]) {
        expect((await approveChange(token, request.id)).status).toBe(403);
        expect((await rejectChange(token, request.id, "لا")).status).toBe(403);
      }

      // A 403 that had already written decidedBy would be worse than applying the change.
      const still = await apiRequest<ChangeRequestDto>(`/api/change-requests/${request.id}`, {
        token: admin.token,
      });
      expect(still.data!.status).toBe("PENDING");
      expect(still.data!.decidedById).toBeNull();
      expect(still.data!.decidedBy).toBeNull();
      expect(still.data!.decidedAt).toBeNull();

      // The stored decider is the Admin who called, not the asker or whoever tried.
      const decided = await approveChange(admin.token, request.id);
      expect(decided.status).toBe(200);
      expect(decided.data!.decidedById).toBe(admin.userId);
      expect(decided.data!.decidedById).not.toBe(manager.userId);
      expect(decided.data!.requestedById).toBe(employee.userId);
    });
  });

  // Every request with a product behind it carries the product's name, so a variant's card is not just "1 · SKU".
  describe("naming the product", () => {
    it("names the product on every kind of request, with the combination beneath it", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const optionSelections = await twoByTwoOptionSelections(admin.token);
      const created = await product(admin.token, "ProductName", { optionSelections, stock: "5" });
      const productName = (created.name as Record<string, string>).ar;
      const [firstVariant] = created.variants;

      const priceAndVisibility = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { basePrice: "9.99", isActive: false },
      });
      expect(priceAndVisibility.status).toBe(200);

      // Through the product form, the only door an Employee has: the stock screen needs inventory.view.
      const variantEdit = await apiRequest<{ pendingChanges: ChangeRequestDto[] }>(
        `/api/products/${created.id}/variants/${firstVariant.id}`,
        { method: "PATCH", token: employee.token, body: { priceOverride: "12", stock: 3 } },
      );
      expect(variantEdit.status).toBe(200);

      // Removing a combination — the variant-set field.
      const variantSet = await apiRequest<{ pendingChange: ChangeRequestDto }>(
        `/api/products/${created.id}/variants/${firstVariant.id}`,
        { method: "DELETE", token: employee.token },
      );
      expect(variantSet.status).toBe(202);

      // A photo.
      const form = new FormData();
      form.append("productId", created.id);
      form.append("file", new Blob([new Uint8Array(ONE_PIXEL_PNG)], { type: "image/png" }), "pixel.png");
      const uploaded = await fetch(`${API_BASE_URL}/api/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${admin.token}`, Origin: API_ORIGIN },
        body: form,
      });
      const image = ((await uploaded.json()) as { data: { id: string } }).data;
      const photo = await apiRequest<{ pendingChange: ChangeRequestDto }>(`/api/images/${image.id}`, {
        method: "DELETE",
        token: employee.token,
      });
      expect(photo.status).toBe(202);

      const filed = [
        ...(await changeRequestsFor(admin.token, "Product", created.id)),
        ...(await changeRequestsFor(admin.token, "Variant", firstVariant.id)),
        ...(await changeRequestsFor(admin.token, "ProductImage", image.id)),
      ];

      // One of every gated shape a product can produce.
      expect(filed.map((c) => c.field).sort()).toEqual(
        ["basePrice", "deletion", "isActive", "priceOverride", "stock", "variantSet"].sort(),
      );

      // THE ASSERTION: whatever the entity is, the card can name the piece.
      for (const request of filed) {
        expect(request.productLabel?.ar).toBe(productName);
        expect(request.productId).toBe(created.id);
      }

      // On a variant the combination stays, as its own label rather than the heading.
      const variantRequests = filed.filter((c) => c.entityType === "Variant");
      expect(variantRequests.length).toBeGreaterThan(0);
      for (const request of variantRequests) {
        expect(request.entityLabel).not.toBeNull();
        expect(request.entityLabel?.ar).not.toBe(productName);
        expect(request.entityDetail).toBe(firstVariant.sku);
      }
    });

    it("heads an expense with its category, having no product to name", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const categoryId = await expenseCategoryId(employee.token);

      const created = await createExpense(employee.token, {
        categoryId,
        amount: "31.50",
        note: `Vitest CR label ${uniqueId()}`,
      });
      expect(created.status).toBe(201);
      createdExpenseIds.push(created.data!.id);

      const request = (await pendingChangeFor(admin.token, "Expense", created.data!.id))!;
      // No product behind an expense, so nothing to head it with but itself.
      expect(request.productLabel).toBeNull();
      expect(request.productId).toBeNull();
      expect(request.entityLabel).not.toBeNull();
    });
  });

  // Withdrawing your own ask is not a decision: only yours, and only while pending (rule 5).
  describe("cancelling", () => {
    async function askedByEmployee(label: string) {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const created = await product(admin.token, label);
      const res = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { basePrice: "4.44" },
      });
      expect(res.status).toBe(200);
      return {
        admin,
        employee,
        productId: created.id,
        request: res.data!.pendingChanges!.find((c) => c.field === "basePrice")!,
      };
    }

    it("lets the person who asked take their own pending request back", async () => {
      const { admin, employee, productId, request } = await askedByEmployee("CancelOwn");

      const before = await apiRequest<ChangeRequestCountDto>("/api/change-requests/count", {
        token: admin.token,
      });

      const cancelled = await cancelChange(employee.token, request.id);
      expect(cancelled.status).toBe(200);
      expect(cancelled.data!.id).toBe(request.id);
      expect(cancelled.data!.cancelled).toBe(true);

      // Gone, not decided: in no tab, and nothing left waiting on the product.
      expect(await changeRequestsFor(admin.token, "Product", productId, "basePrice")).toHaveLength(0);
      expect((await apiRequest(`/api/change-requests/${request.id}`, { token: admin.token })).status).toBe(404);

      // ...and the badge in the navigation counts one fewer.
      const after = await apiRequest<ChangeRequestCountDto>("/api/change-requests/count", { token: admin.token });
      expect(after.data!.pending).toBe(before.data!.pending - 1);

      const untouched = await apiRequest<ProductDto>(`/api/products/${productId}`, { token: admin.token });
      expect(Number(untouched.data!.basePrice)).toBe(100);
      expect(untouched.data!.pendingChanges).toEqual([]);

      // The slot is free, so the same field can be asked about again at once.
      const again = await apiRequest<ProductDto>(`/api/products/${productId}`, {
        method: "PATCH",
        token: employee.token,
        body: { basePrice: "5.55" },
      });
      expect(again.data!.pendingChanges!.filter((c) => c.field === "basePrice")).toHaveLength(1);
    });

    it("refuses anybody else — including the Admin who would decide it", async () => {
      const { admin, employee, request } = await askedByEmployee("CancelOther");
      const manager = await getSession("MANAGER");

      // An Admin has reject; making somebody else's request disappear is on offer to nobody.
      for (const token of [admin.token, manager.token]) {
        const res = await cancelChange(token, request.id);
        expect(res.status).toBe(403);
        expect(res.error?.code).toBe(ERROR_CODES.CHANGE_REQUEST_NOT_REQUESTER);
      }

      // Still there, still waiting, still owned by whoever asked.
      const still = await apiRequest<ChangeRequestDto>(`/api/change-requests/${request.id}`, {
        token: admin.token,
      });
      expect(still.status).toBe(200);
      expect(still.data!.status).toBe("PENDING");
      expect(still.data!.requestedById).toBe(employee.userId);

      // ...and the one person it does belong to can still take it back.
      expect((await cancelChange(employee.token, request.id)).status).toBe(200);
    });

    it("refuses a decided request, so a decision can never be erased", async () => {
      for (const decision of ["approve", "reject"] as const) {
        const { admin, employee, request } = await askedByEmployee(`CancelDecided-${decision}`);

        const decided =
          decision === "approve"
            ? await approveChange(admin.token, request.id)
            : await rejectChange(admin.token, request.id, "لا");
        expect(decided.status).toBe(200);

        const res = await cancelChange(employee.token, request.id);
        expect(res.status).toBe(409);
        expect(res.error?.code).toBe(ERROR_CODES.CHANGE_REQUEST_NOT_PENDING);

        // The record stands, with the decision still on it.
        const after = await apiRequest<ChangeRequestDto>(`/api/change-requests/${request.id}`, {
          token: admin.token,
        });
        expect(after.status).toBe(200);
        expect(after.data!.decidedById).toBe(admin.userId);
      }
    });

    it("404s on a request that does not exist", async () => {
      const employee = await getSession("EMPLOYEE");
      const res = await cancelChange(employee.token, "no-such-change-request");
      expect(res.status).toBe(404);
      expect(res.error?.code).toBe(ERROR_CODES.CHANGE_REQUEST_NOT_FOUND);
    });
  });

  describe("sales", () => {
    // Manual stock is gated; stock sold never is — a sale with a customer waiting always completes.
    it("still deducts stock for an Employee's sale, with nothing waiting for approval", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const sellable = await createSellableProduct(admin.token, { stock: 10 });
      createdProductIds.push(sellable.id);

      const order = await apiRequest<OrderDto>("/api/orders", {
        method: "POST",
        token: employee.token,
        body: { channel: "STORE", items: [{ productId: sellable.id, quantity: 3 }] },
      });
      expect(order.status).toBe(201);
      expect(order.data!.stockDeductedAt).not.toBeNull();

      // Applied immediately, not held.
      expect(await readStock(admin.token, sellable.id)).toBe(7);
      expect(await pendingChangeFor(admin.token, "Product", sellable.id)).toBeUndefined();
    });

    // A return restores stock at once: a refund cannot wait for an Admin.
    it("still restores stock on a return", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const sellable = await createSellableProduct(admin.token, { stock: 10 });
      createdProductIds.push(sellable.id);

      const order = await apiRequest<OrderDto>("/api/orders", {
        method: "POST",
        token: employee.token,
        body: { channel: "STORE", items: [{ productId: sellable.id, quantity: 2 }] },
      });
      expect(await readStock(admin.token, sellable.id)).toBe(8);

      const returned = await apiRequest(`/api/orders/${order.data!.id}/return`, {
        method: "POST",
        token: admin.token,
        body: { items: [{ orderItemId: order.data!.items[0].id, quantity: 2 }] },
      });
      expect(returned.status).toBe(200);
      expect(await readStock(admin.token, sellable.id)).toBe(10);
      expect(await pendingChangeFor(admin.token, "Product", sellable.id)).toBeUndefined();
    });
  });
});
