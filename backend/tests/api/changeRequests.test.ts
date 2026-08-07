import { afterAll, describe, expect, it } from "vitest";
import { API_BASE_URL, API_ORIGIN, apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anyCategoryId, twoByTwoOptionSelections } from "@tests/support/fixtures";
import { createSellableProduct, readStock } from "@tests/support/orders";
import {
  approveChange,
  changeRequestsFor,
  listChangeRequests,
  pendingChangeFor,
  rejectChange,
} from "@tests/support/changeRequests";
import { createExpense, expenseCategoryId } from "@tests/support/cash";
import type {
  ChangeRequestCountDto,
  ChangeRequestDto,
  ExpenseDto,
  OrderDto,
  ProductDto,
} from "@tests/types";
import { ERROR_CODES } from "@/constants";

// The generic change-approval flow (spec.md "Employee change approvals").
//
// Five things an Employee may ask for but not do — a product's price, a
// manual stock figure, deleting a photo, hiding or unhiding a product, and
// changing which variants a product has — plus the sixth that was lifted into
// the same mechanism, an expense's approval (that one is asserted in
// expenses.test.ts, where the expenses are).
//
// What every case has to prove is the same shape: the value did NOT change,
// something is waiting with the old and the requested value on it, only an
// Admin can decide it, approving applies it and rejecting discards it.
//
// Like the rest of the suite this runs against a LIVE API holding other
// people's requests, so nothing asserts a total — requests are always looked
// up by the entity they are about.

// The smallest valid PNG there is: one transparent pixel. Enough for sharp to
// process into the three sizes, which is all the photo-deletion case needs.
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
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

  async function product(
    token: string,
    label: string,
    body: Record<string, unknown> = {}
  ): Promise<ProductDto> {
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

  // -------------------------------------------------------------------------
  // Each gated action files a request instead of applying
  // -------------------------------------------------------------------------
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

      expect(Number((await apiRequest<ProductDto>(`/api/products/${created.id}`, { token: admin.token })).data!
        .basePrice)).toBe(100);
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

      // The same gate holds in the other direction: an Employee cannot put a
      // hidden product back on the shelf either.
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
      // The option VALUE IDS are what is stored, never the names they happen
      // to have today (CLAUDE.md rule 2).
      expect(addRequest.newValue!.detail!.optionSelections).toHaveLength(2);

      // Removing: an Employee cannot pull a combination out either.
      const withVariants = await product(admin.token, "VariantRemove", { optionSelections });
      const variant = withVariants.variants[0];
      const remove = await apiRequest<{ id: string; deleted: boolean; pendingChange: ChangeRequestDto }>(
        `/api/products/${withVariants.id}/variants/${variant.id}`,
        { method: "DELETE", token: employee.token }
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
        { method: "DELETE", token: employee.token }
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

    // Admin and Manager are unaffected by every one of the above: they hold
    // the permissions, so their edits land immediately and file nothing.
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

  // -------------------------------------------------------------------------
  // Superseding
  // -------------------------------------------------------------------------
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
        `?status=PENDING&entityType=Product&entityId=${created.id}&pageSize=100`
      );
      expect(listed.data!.filter((c) => c.field === "basePrice")).toHaveLength(1);

      // Approving the survivor applies the NEWER figure — the stale one is
      // gone, not merely ordered behind it.
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
      // A NEW row: the decided one keeps its decision, and the slot it held
      // while pending was freed when it was decided.
      expect(held).toHaveLength(1);
      expect(held[0].id).not.toBe(firstId);
    });
  });

  // -------------------------------------------------------------------------
  // Who may decide
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Reading
  // -------------------------------------------------------------------------
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

      const asAdmin = await listChangeRequests(
        admin.token,
        `?status=PENDING&entityId=${created.id}&pageSize=100`
      );
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

  // -------------------------------------------------------------------------
  // What the approvals screen is allowed to say
  //
  // The screen has three tabs and draws one card per request, so two things
  // have to hold or it contradicts itself in front of an Admin: a decided
  // request must carry the decision that was actually made, and each tab must
  // list only requests in its own state. Both are the API's answer, not the
  // frontend's — a card can only be as truthful as the row behind it.
  // -------------------------------------------------------------------------
  describe("status, as reported", () => {
    // Two requests on two products, one turned down and one signed off, so
    // every assertion below reads a real decided row rather than a fixture.
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

      // ...and off the list the screen actually draws from. A card renders
      // whatever this row says, so this is the value the badge shows.
      const listed = await changeRequestsFor(admin.token, "Product", rejected.productId, "basePrice");
      expect(listed).toHaveLength(1);
      expect(listed[0].status).toBe("REJECTED");
      // Its decision is on it, so the card needs no second lookup to say who.
      expect(listed[0].decidedBy?.id).toBe(admin.userId);
      expect(listed[0].decisionNote).toBe("غالي");
      // A refusal changes the request and nothing else: the value asked for
      // is still on the row (that is what the card shows), and the product
      // still holds the price it always had.
      expect(listed[0].newValue).toEqual({ kind: "money", value: "11.00" });
      const untouched = await apiRequest<ProductDto>(`/api/products/${rejected.productId}`, { token: admin.token });
      expect(Number(untouched.data!.basePrice)).toBe(100);
    });

    it("lists a request under its own status tab only", async () => {
      const { admin, rejected, approved } = await decidedPair();

      // Each tab is one status= call. Every row it returns must be in that
      // state — otherwise a card lands under a heading that contradicts it,
      // which is exactly the bug this covers.
      for (const status of ["PENDING", "APPROVED", "REJECTED"] as const) {
        const tab = await listChangeRequests(admin.token, `?status=${status}&pageSize=100`);
        expect(tab.status).toBe(200);
        expect(tab.data!.every((c) => c.status === status)).toBe(true);
      }

      // ...and the two known rows land in one tab each, not in two and not in
      // none. Scoped to their own product so other people's requests on the
      // same live database cannot make this pass or fail by accident.
      for (const { id, productId, belongs } of [
        { ...rejected, belongs: "REJECTED" },
        { ...approved, belongs: "APPROVED" },
      ] as const) {
        for (const status of ["PENDING", "APPROVED", "REJECTED"] as const) {
          const tab = await listChangeRequests(
            admin.token,
            `?status=${status}&entityType=Product&entityId=${productId}&pageSize=100`
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

      // Deciding again — the other way, by anyone — is refused rather than
      // overwriting who agreed to what. That is what keeps ONE decision one.
      expect((await approveChange(admin.token, request.id)).status).toBe(409);
      expect((await rejectChange(manager.token, request.id)).status).toBe(403);

      const after = await apiRequest<ChangeRequestDto>(`/api/change-requests/${request.id}`, {
        token: admin.token,
      });
      expect(after.data!.status).toBe("REJECTED");
      expect(after.data!.decidedById).toBe(decidedById);
      expect(after.data!.decidedAt).toBe(decidedAt);

      // And ONE row carries it. Not two rows describing the same refusal
      // under two different deciders, which is what an approvals screen with
      // duplicate records looks like.
      const rows = await changeRequestsFor(admin.token, "Product", request.entityId, "basePrice");
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(request.id);
    });

    // The expense approval is the same mechanism (spec.md "Employee change
    // approvals") and the one where every request asks for the identical
    // thing — PENDING → APPROVED — so a refused one is where a screen that
    // reads the ASKED-FOR value instead of the STATUS says "approved" under
    // the Rejected tab. Its row has to be unambiguous about which happened.
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
      // Every one of these asks for the same thing, which is precisely why
      // the request's own status is the only honest answer once it is decided.
      expect(asked.newValue).toEqual({ kind: "approval", value: "APPROVED" });

      const refused = await rejectChange(admin.token, asked.id, "مسجّلة مرتين");
      expect(refused.status).toBe(200);
      expect(refused.data!.status).toBe("REJECTED");
      expect(refused.data!.decidedBy?.id).toBe(admin.userId);

      // One row for this expense, in the REJECTED state, decided by the Admin
      // — never the same refusal listed twice under two deciders.
      const rows = await changeRequestsFor(admin.token, "Expense", created.data!.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("REJECTED");
      expect(rows[0].decidedById).toBe(admin.userId);

      // ...and the expense itself agrees with it, so the two screens that
      // show this spending cannot disagree either.
      const expense = await apiRequest<ExpenseDto>(`/api/expenses/${created.data!.id}`, { token: admin.token });
      expect(expense.data!.approvalStatus).toBe("REJECTED");
      expect(expense.data!.approvedBy?.id).toBe(admin.userId);
    });

    // Rule 5 / rule 21: deciding is changeRequest.approve, and only an Admin
    // holds it. A Manager holds expense.approve — "the spending I record
    // MYSELF counts immediately" — which is a different thing and must not
    // let them sign off somebody else's request.
    it("refuses every non-Admin, on both endpoints, and stores no decider when it does", async () => {
      const admin = await getSession("ADMIN");
      const manager = await getSession("MANAGER");
      const employee = await getSession("EMPLOYEE");
      const { request } = await heldPriceForDecision("NonAdminDecider");

      for (const token of [manager.token, employee.token]) {
        expect((await approveChange(token, request.id)).status).toBe(403);
        expect((await rejectChange(token, request.id, "لا")).status).toBe(403);
      }

      // Refused means refused: still waiting, and nobody recorded as having
      // decided it. A 403 that had already written decidedBy would be worse
      // than one that applied the change.
      const still = await apiRequest<ChangeRequestDto>(`/api/change-requests/${request.id}`, {
        token: admin.token,
      });
      expect(still.data!.status).toBe("PENDING");
      expect(still.data!.decidedById).toBeNull();
      expect(still.data!.decidedBy).toBeNull();
      expect(still.data!.decidedAt).toBeNull();

      // ...and when it IS decided, the stored decider is the Admin who called,
      // not whoever asked and not whoever tried.
      const decided = await approveChange(admin.token, request.id);
      expect(decided.status).toBe(200);
      expect(decided.data!.decidedById).toBe(admin.userId);
      expect(decided.data!.decidedById).not.toBe(manager.userId);
      expect(decided.data!.requestedById).toBe(employee.userId);
    });
  });

  // -------------------------------------------------------------------------
  // The line the gate must never cross
  // -------------------------------------------------------------------------
  describe("sales", () => {
    // Manual stock edits are gated; stock coming off the shelf because
    // something was SOLD is not, and must never be. A counter sale has a
    // customer standing there — it completes on the spot, whoever rang it up.
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

    // ...and the same for the other end of a sale: a return puts stock back
    // there and then, because refusing a customer their money until an Admin
    // wakes up is not a thing a shop can do.
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
