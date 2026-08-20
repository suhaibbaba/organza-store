// ============================================================================
//  8. PERMISSIONS — every role against every sensitive action
//
//  Enforced on the BACKEND, not hidden in a UI (CLAUDE.md rule 5). Every
//  refusal below is asserted twice: the status code, AND that the thing it
//  refused did not happen anyway.
//
//    * an EMPLOYEE may ring up a sale and hand it to the courier, and nothing
//      else that touches money: no inventory, no cost, no profit, no deleting
//      or hiding a product, no re-pricing, no editing/cancelling/deleting an
//      order, no declaring its money received, no gifts, no users, no
//      settings, and no approving anything — including their own request;
//    * a MANAGER runs the shop floor but may not see COST or PROFIT (Admin
//      only), and may not manage users or settings;
//    * an Employee's gated edit is HELD as a request rather than applied,
//      only an Admin may decide it, approving applies it atomically and
//      rejecting discards it;
//    * and no endpoint anywhere leaks cost, unitCost, COGS, profit, margin or
//      idNumber to a role that may not see it — checked by walking every
//      response, nested objects and list rows included.
// ============================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "@tests/support/client";
import { fetchPermissionMatrix } from "@tests/support/permissions";
import { getSession } from "@tests/support/auth";
import { allocateDate } from "@tests/support/cash";
import { pendingChangeFor, approveChange, rejectChange } from "@tests/support/changeRequests";
import { expectCount, expectPrice } from "@tests/support/money";
import { randomPalestinePhone } from "@tests/support/phone";
import {
  collect,
  createPricedProduct,
  readOrder,
  readProduct,
  readStock,
  returnOrderRequest,
  sell,
  sellOnCredit,
  sellRequest,
  setStatus,
} from "@tests/support/verify";
import { COST_BEARING_KEYS, REPRICED_BASE_PRICE, UNIT_COST, UNIT_PRICE } from "@tests/constants";
import type { PricedProduct, ProductDto } from "@tests/types";

/**
 * Walks a whole response and reports every path at which a forbidden key
 * appears — list rows and nested objects included, which is exactly where a
 * leak would hide.
 */
function leakedPaths(value: unknown, forbidden: readonly string[], path = "$"): string[] {
  if (value === null || typeof value !== "object") return [];

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => leakedPaths(entry, forbidden, `${path}[${index}]`));
  }

  const found: string[] = [];
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (forbidden.includes(key)) found.push(`${path}.${key} = ${JSON.stringify(nested)}`);
    found.push(...leakedPaths(nested, forbidden, `${path}.${key}`));
  }
  return found;
}

describe("Verify · permissions and data exposure", () => {
  let admin: string;
  let manager: string;
  let employee: string;
  let product: PricedProduct;

  beforeAll(async () => {
    admin = (await getSession("ADMIN")).token;
    manager = (await getSession("MANAGER")).token;
    employee = (await getSession("EMPLOYEE")).token;
    product = await createPricedProduct(admin, { basePrice: UNIT_PRICE, cost: UNIT_COST, stock: 100 });
  });

  // ==========================================================================
  describe("what an Employee may not even look at", () => {
    const shutDoors = [
      ["the inventory list", "/api/inventory?pageSize=5"],
      ["the dashboard", "/api/dashboard/summary"],
      ["the expense list", "/api/expenses?pageSize=5"],
      ["the cash drawer", "/api/cash-sessions/current"],
      ["the cash-session list", "/api/cash-sessions?pageSize=5"],
      ["the staff list", "/api/users?pageSize=5"],
    ] as const;

    it.each(shutDoors)("refuses an Employee %s", async (_what, path) => {
      const res = await apiRequest(path, { token: employee });
      expect(res.status, `an Employee must not read ${path}`).toBe(403);
      expect(res.success, "and is refused through the error envelope").toBe(false);
      expect(res.error?.code, "with a translation key, never a sentence").toBe("error.forbidden");
    });

    it("refuses an Employee an adjustment through the inventory route", async () => {
      const before = await readStock(admin, product.id);
      const res = await apiRequest(`/api/inventory/products/${product.id}`, {
        method: "PATCH",
        token: employee,
        body: { stock: 999 },
      });
      expect(res.status).toBe(403);
      expectCount(await readStock(admin, product.id), before, "stock after the refused adjustment");
    });
  });

  // ==========================================================================
  describe("what an Employee may not do to a product", () => {
    it("refuses to delete one, and the product is still there", async () => {
      const victim = await createPricedProduct(admin);

      const res = await apiRequest(`/api/products/${victim.id}`, { method: "DELETE", token: employee });
      expect(res.status, "deleting a product is not an Employee's to do").toBe(403);

      const still = await readProduct(admin, victim.id);
      expect(still.deletedAt, "and the product must still be on the books").toBeNull();
    });

    it("holds the additive option permission and not the destructive one", async () => {
      // A rename reaches every product using that value at once (CLAUDE.md
      // rule 2), so it belongs to Admin/Manager. There is no rename or delete
      // ENDPOINT yet — the API exposes GET plus the two creates — so what is
      // pinned here is the layer that exists: an Employee may append to the
      // global lists and may not touch what is already on them, and the
      // routes really are absent rather than merely unlisted.
      //
      // Read from the API rather than from the constant it is seeded with:
      // both of these are configurable per shop now (spec.md "Editable role
      // permissions"), so what has to hold is what is IN FORCE — which is the
      // baseline this suite writes for itself in tests/setup.ts.
      const matrix = await fetchPermissionMatrix();
      expect(matrix.roles.EMPLOYEE, "an Employee may add an option value").toContain("variantType.create");
      expect(matrix.roles.EMPLOYEE, "and may not rename or remove one").not.toContain("variantType.manage");
      for (const role of ["ADMIN", "MANAGER"] as const) {
        expect(matrix.roles[role], `a ${role} may`).toContain("variantType.manage");
      }

      const types = await apiRequest<{ id: string }[]>("/api/variant-types", { token: employee });
      const type = types.data![0];

      for (const method of ["PATCH", "DELETE"] as const) {
        const res = await apiRequest(`/api/variant-types/${type.id}`, {
          method,
          token: employee,
          ...(method === "PATCH" ? { body: { name: { ar: "محاولة", en: "[verify] attempted rename" } } } : {}),
        });
        expect(res.status, `there is no ${method} /api/variant-types/:id for anyone to reach`).toBe(404);
      }

      // ...and the additive half genuinely works for them, so the refusal
      // above is a gate rather than a broken route.
      const added = await apiRequest(`/api/variant-types/${type.id}/values`, {
        method: "POST",
        token: employee,
        body: { value: { ar: `لون ${uniqueId()}`, en: `[verify] colour ${uniqueId()}` } },
      });
      expect(added.status, "an Employee may append a new value").toBe(201);
    });
  });

  // ==========================================================================
  describe("what an Employee may not do to an order", () => {
    it("lets them ring one up and hand it to the courier — and nothing beyond that", async () => {
      const order = await sell(employee, [{ productId: product.id, quantity: 1 }], { channel: "WHATSAPP" });
      expect(order.status, "an Employee's order opens NEW").toBe("NEW");

      for (const status of ["PREPARING", "HANDED_TO_COURIER"]) {
        const res = await setStatus(employee, order.id, status);
        expect(res.status, `an Employee may advance an order to ${status}`).toBe(200);
      }
    });

    it("refuses to edit, cancel, return, delete or collect — and nothing about the order moves", async () => {
      const order = await sellOnCredit(admin, [{ productId: product.id, quantity: 2 }]);
      const before = await readOrder(admin, order.id);

      const attempts: [string, Promise<{ status: number; error?: { code: string } }>][] = [
        ["edit it", apiRequest(`/api/orders/${order.id}`, { method: "PATCH", token: employee, body: { note: "x" } })],
        ["cancel it", setStatus(employee, order.id, "CANCELLED")],
        ["return it", returnOrderRequest(employee, order.id)],
        ["delete it", apiRequest(`/api/orders/${order.id}`, { method: "DELETE", token: employee })],
        ["declare its money received", collect(employee, [order.id])],
      ];

      for (const [what, request] of attempts) {
        const res = await request;
        expect(res.status, `an Employee must not ${what}`).toBe(403);
        expect(res.error?.code).toBe("error.forbidden");
      }

      const after = await readOrder(admin, order.id);
      expect(after.status, "status after every refusal").toBe(before.status);
      expect(after.paymentStatus, "payment status after every refusal").toBe(before.paymentStatus);
      expect(after.note, "note after every refusal").toBe(before.note);
      expectCount(after.items[0].returnedQuantity, 0, "returned quantity after every refusal");
    });

    it("refuses to file a sale as a GIFT — that is how a piece walks out", async () => {
      const before = await readStock(admin, product.id);

      const res = await sellRequest(employee, [{ productId: product.id, quantity: 1 }], { type: "GIFT" });
      expect(res.status, "giving stock away is Admin/Manager only").toBe(403);
      expect(res.error?.code).toBe("error.forbidden");
      expectCount(await readStock(admin, product.id), before, "stock after the refused gift");
    });
  });

  // ==========================================================================
  describe("what a Manager may not do", () => {
    it("refuses them the staff list and any change to it", async () => {
      const list = await apiRequest("/api/users?pageSize=5", { token: manager });
      expect(list.status, "the staff list is Admin only (it carries idNumber)").toBe(403);

      const created = await apiRequest("/api/users", {
        method: "POST",
        token: manager,
        body: {
          name: `[verify] ${uniqueId()}`,
          email: `verify-${uniqueId()}@organza.test`,
          password: "password123",
          role: "EMPLOYEE",
          phone: randomPalestinePhone(),
        },
      });
      expect(created.status, "and creating staff is Admin only").toBe(403);
    });

    it("refuses them the settings", async () => {
      const res = await apiRequest("/api/settings", {
        method: "PATCH",
        token: manager,
        body: { lowStockThreshold: 99 },
      });
      expect(res.status, "settings are Admin only").toBe(403);

      const setting = await apiRequest<{ lowStockThreshold: number }>("/api/settings", { token: admin });
      expect(setting.data!.lowStockThreshold, "and the threshold must not have moved").not.toBe(99);
    });

    it("values the inventory at PRICE, not at cost — the owner's margin is not theirs to read", async () => {
      const asAdmin = await apiRequest<{ inventoryValue: { basis: string } }>("/api/dashboard/summary", {
        token: admin,
      });
      const asManager = await apiRequest<{ inventoryValue: { basis: string } }>("/api/dashboard/summary", {
        token: manager,
      });

      expect(asAdmin.data!.inventoryValue.basis, "an Admin values stock at what it cost").toBe("cost");
      expect(asManager.data!.inventoryValue.basis, "a Manager values it at what it sells for").toBe("price");
    });

    it("refuses them the approval of somebody else's request", async () => {
      const victim = await createPricedProduct(admin, { basePrice: UNIT_PRICE });
      await apiRequest(`/api/products/${victim.id}`, {
        method: "PATCH",
        token: employee,
        body: { basePrice: REPRICED_BASE_PRICE },
      });
      const pending = await pendingChangeFor(admin, "Product", victim.id, "basePrice");
      expect(pending, "the Employee's edit must be waiting").toBeDefined();

      const res = await approveChange(manager, pending!.id);
      expect(res.status, "deciding somebody else's request is the Admin's").toBe(403);

      const still = await readProduct(admin, victim.id);
      expectPrice(still.basePrice, UNIT_PRICE, "the price after the refused approval");
    });
  });

  // ==========================================================================
  describe("nothing derived from cost ever leaves the backend", () => {
    // Every endpoint the two roles can actually read. A leak would show up as
    // a key anywhere in the payload — a list row, a nested variant, a channel
    // entry — which is why the whole tree is walked rather than the top level.
    const sharedReads = [
      "/api/products?pageSize=10",
      "/api/orders?pageSize=10",
      "/api/change-requests?pageSize=10",
      "/api/categories?flat=true",
      "/api/variant-types",
      "/api/settings",
    ];

    // The shop-wide money screens. These are not "a report with the costs
    // taken out" — they are refused outright to whoever may not read them,
    // which is a different and stronger thing:
    //   * the Reports page (report.view) is ADMIN ONLY, so both roles are out;
    //   * the dashboard's sales block (dashboard.view) and the outstanding
    //     total (order.markCollected) answer a Manager and refuse an Employee,
    //     who sees the orders they took and nothing added up.
    function moneyReads(role: "manager" | "employee", range: string): { path: string; status: number }[] {
      const managerOnly = role === "manager" ? 200 : 403;
      return [
        { path: `/api/reports/sales?from=${range}&to=${range}&tzOffset=0&topLimit=50`, status: 403 },
        { path: "/api/reports/sales-summary?tzOffset=0", status: managerOnly },
        { path: "/api/orders/collection-summary", status: managerOnly },
      ];
    }

    it.each([
      ["a Manager", "manager", () => manager],
      ["an Employee", "employee", () => employee],
    ] as const)("returns no cost, COGS, profit, margin or idNumber to %s", async (_who, role, tokenOf) => {
      const token = tokenOf();
      const order = await sell(admin, [{ productId: product.id, quantity: 1 }]);

      const range = new Date().toISOString().slice(0, 10);
      const paths = [
        ...sharedReads,
        `/api/products/${product.id}`,
        `/api/products/lookup?code=${encodeURIComponent(product.product.barcode!)}`,
        `/api/orders/${order.id}`,
      ];

      for (const path of paths) {
        const res = await apiRequest(path, { token });
        expect(res.status, `${path} must answer this role (or be refused outright, not half-answered)`).toBe(200);

        const leaks = leakedPaths(res.data, COST_BEARING_KEYS);
        expect(
          leaks,
          `${path} leaked cost-derived data:\n   ${leaks.join("\n   ")}`
        ).toEqual([]);
      }

      for (const { path, status } of moneyReads(role, range)) {
        const res = await apiRequest(path, { token });
        expect(res.status, `${path} must answer this role with exactly ${status}`).toBe(status);

        if (status === 403) {
          // A refusal carries no figures at all — not zeroed ones, none.
          expect(res.data, `${path} must return nothing when it refuses`).toBeUndefined();
          continue;
        }

        const leaks = leakedPaths(res.data, COST_BEARING_KEYS);
        expect(
          leaks,
          `${path} leaked cost-derived data:\n   ${leaks.join("\n   ")}`
        ).toEqual([]);
      }
    });

    it("keeps the Reports screen on the owner's side of the permission table", async () => {
      // The rules IN FORCE on the target, not the constant they are seeded
      // from — and for report.view and product.viewCost the two can never
      // differ anyway: both are PROTECTED, so no shop can move them at all.
      // dashboard.view is configurable, and what is asserted about it is the
      // baseline this suite writes in tests/setup.ts.
      const matrix = await fetchPermissionMatrix();

      expect(matrix.roles.ADMIN, "an Admin reads the reports").toContain("report.view");
      expect(matrix.protectedActions, "and no shop may hand that out").toContain("report.view");
      expect(matrix.protectedActions, "nor cost and profit").toContain("product.viewCost");

      for (const role of ["MANAGER", "EMPLOYEE"] as const) {
        // Its own action, deliberately: it used to ride on order.view, which
        // an Employee holds so they can follow the orders they take.
        expect(matrix.roles[role], `a ${role} must not hold report.view`).not.toContain("report.view");
        expect(matrix.roles[role], `a ${role} must not hold product.viewCost`).not.toContain("product.viewCost");
      }
      expect(matrix.roles.EMPLOYEE, "an Employee has no shop-wide overview at all").not.toContain("dashboard.view");
    });

    it("returns them all to an Admin, so the absence above is a gate and not a gap", async () => {
      const order = await sell(admin, [{ productId: product.id, quantity: 1 }]);
      const range = new Date().toISOString().slice(0, 10);

      const detail = await readProduct(admin, product.id);
      expectPrice(detail.cost, UNIT_COST, "the product's cost, to an Admin");

      const line = await readOrder(admin, order.id);
      expect(line.items[0].unitCost, "the line's unit cost, to an Admin").toBeDefined();

      const report = await apiRequest<Record<string, unknown>>(
        `/api/reports/sales?from=${range}&to=${range}&tzOffset=0`,
        { token: admin }
      );
      expect(report.data!.profit, "the profit block, to an Admin").toBeDefined();
      expect(
        leakedPaths(report.data, COST_BEARING_KEYS).length,
        "an Admin's report must be full of exactly the figures the others are refused"
      ).toBeGreaterThan(0);
    });

    it("hides an Employee's own inability to see cost even on a product they created", async () => {
      const created = await apiRequest<ProductDto>("/api/products", {
        method: "POST",
        token: employee,
        body: {
          name: { ar: `منتج موظف ${uniqueId()}`, en: `[verify] employee product ${uniqueId()}` },
          categoryId: (await apiRequest<{ id: string }[]>("/api/categories?flat=true", { token: employee })).data![0]
            .id,
          basePrice: "10.00",
          cost: "5.00",
          stock: "1",
        },
      });
      expect(created.status, "an Employee may add a product").toBe(201);
      expect(leakedPaths(created.data, COST_BEARING_KEYS), "and still may not read its cost back").toEqual([]);
    });
  });

  // ==========================================================================
  describe("the five gated edits are held, not applied and not refused", () => {
    it("holds a price change against the price still in force", async () => {
      const victim = await createPricedProduct(admin, { basePrice: UNIT_PRICE });

      const res = await apiRequest<ProductDto>(`/api/products/${victim.id}`, {
        method: "PATCH",
        token: employee,
        body: { basePrice: REPRICED_BASE_PRICE },
      });

      expect(res.status, "the edit is accepted, not refused").toBe(200);
      expectPrice(res.data!.basePrice, UNIT_PRICE, "the price on the response (still the one in force)");

      const held = res.data!.pendingChanges?.find((change) => change.field === "basePrice");
      expect(held, "and the new figure is held against it").toBeDefined();
      expect(held!.status).toBe("PENDING");
      expect(String(held!.newValue?.value), "the figure being asked for").toBe(REPRICED_BASE_PRICE);

      expectPrice((await readProduct(admin, victim.id)).basePrice, UNIT_PRICE, "the stored price");
    });

    it("holds a manual stock change and a hide, on the same route", async () => {
      const victim = await createPricedProduct(admin, { stock: 7 });

      const res = await apiRequest<ProductDto>(`/api/products/${victim.id}`, {
        method: "PATCH",
        token: employee,
        body: { stock: 99, isActive: false },
      });
      expect(res.status).toBe(200);

      const stored = await readProduct(admin, victim.id);
      expectCount(stored.stock!, 7, "stock (the manual change is only a request)");
      expect(stored.isActive, "visibility (hiding is only a request)").toBe(true);

      const fields = (stored.pendingChanges ?? []).map((change) => change.field);
      expect(fields, "both changes are waiting").toEqual(expect.arrayContaining(["stock", "isActive"]));
    });

    it("replaces a pending request rather than queueing a second one", async () => {
      const victim = await createPricedProduct(admin, { basePrice: UNIT_PRICE });

      await apiRequest(`/api/products/${victim.id}`, {
        method: "PATCH",
        token: employee,
        body: { basePrice: "150.00" },
      });
      await apiRequest(`/api/products/${victim.id}`, {
        method: "PATCH",
        token: employee,
        body: { basePrice: "175.00" },
      });

      const stored = await readProduct(admin, victim.id);
      const priceRequests = (stored.pendingChanges ?? []).filter((change) => change.field === "basePrice");
      expectCount(priceRequests.length, 1, "pending price requests on one product");
      expect(String(priceRequests[0].newValue?.value), "and it is the LATEST figure asked for").toBe("175.00");
    });

    it("lets only an Admin decide, and applies the change atomically on approval", async () => {
      const victim = await createPricedProduct(admin, { basePrice: UNIT_PRICE });
      await apiRequest(`/api/products/${victim.id}`, {
        method: "PATCH",
        token: employee,
        body: { basePrice: REPRICED_BASE_PRICE },
      });
      const pending = (await pendingChangeFor(admin, "Product", victim.id, "basePrice"))!;

      // The person who asked must never be the person who decides.
      const byEmployee = await approveChange(employee, pending.id);
      expect(byEmployee.status, "an Employee may not sign off their own request").toBe(403);
      const byManager = await approveChange(manager, pending.id);
      expect(byManager.status, "nor may a Manager sign off somebody else's").toBe(403);
      expectPrice((await readProduct(admin, victim.id)).basePrice, UNIT_PRICE, "the price after both refusals");

      const approved = await approveChange(admin, pending.id);
      expect(approved.status, "an Admin may").toBe(200);
      expect(approved.data!.status).toBe("APPROVED");

      const after = await readProduct(admin, victim.id);
      expectPrice(after.basePrice, REPRICED_BASE_PRICE, "the price once the request was approved");
      expectCount((after.pendingChanges ?? []).length, 0, "requests still waiting on this product");

      // Deciding it twice would overwrite who decided what.
      const again = await approveChange(admin, pending.id);
      expect(again.status, "an already-decided request cannot be decided again").toBe(409);
      expect(again.error?.code).toBe("error.changeRequest.not_pending");
    });

    it("discards the change on rejection, leaving the value exactly as it was", async () => {
      const victim = await createPricedProduct(admin, { basePrice: UNIT_PRICE });
      await apiRequest(`/api/products/${victim.id}`, {
        method: "PATCH",
        token: employee,
        body: { basePrice: REPRICED_BASE_PRICE },
      });
      const pending = (await pendingChangeFor(admin, "Product", victim.id, "basePrice"))!;

      const rejected = await rejectChange(admin, pending.id, "[verify] not this time");
      expect(rejected.status).toBe(200);
      expect(rejected.data!.status).toBe("REJECTED");
      expect(rejected.data!.decisionNote, "and the reason is kept").toBe("[verify] not this time");

      const after = await readProduct(admin, victim.id);
      expectPrice(after.basePrice, UNIT_PRICE, "the price after the rejection");
      expectCount((after.pendingChanges ?? []).length, 0, "requests still waiting after the rejection");
    });

    it("shows an Employee only their own requests, and an Admin everybody's", async () => {
      const victim = await createPricedProduct(admin, { basePrice: UNIT_PRICE });
      await apiRequest(`/api/products/${victim.id}`, {
        method: "PATCH",
        token: employee,
        body: { basePrice: REPRICED_BASE_PRICE },
      });

      const employeeId = (await getSession("EMPLOYEE")).userId;
      const theirs = await apiRequest<{ requestedById: string }[]>("/api/change-requests?pageSize=100", {
        token: employee,
      });
      expect(theirs.status).toBe(200);
      expect(
        (theirs.data ?? []).every((change) => change.requestedById === employeeId),
        "an Employee sees what they asked for, and nothing else"
      ).toBe(true);

      const all = await apiRequest<{ id: string }[]>("/api/change-requests?pageSize=100&status=PENDING", {
        token: admin,
      });
      expect(all.status, "an Admin sees everything waiting").toBe(200);
    });
  });

  // ==========================================================================
  describe("a sale is never gated, whoever rings it up", () => {
    it("deducts an Employee's sale on the spot, with nothing left waiting", async () => {
      const item = await createPricedProduct(admin, { stock: 5 });

      const order = await sell(employee, [{ productId: item.id, quantity: 2 }]);
      expect(order.status, "there is a customer standing there").toBe("COMPLETED");
      expectCount(await readStock(admin, item.id), 3, "stock after an Employee's sale");

      const stored = await readProduct(admin, item.id);
      expectCount((stored.pendingChanges ?? []).length, 0, "requests filed by the sale");
    });
  });

  // ==========================================================================
  describe("no session, no answer", () => {
    it("refuses an unauthenticated caller everywhere money is involved", async () => {
      const paths = [
        "/api/orders",
        "/api/products",
        "/api/reports/sales-summary?tzOffset=0",
        "/api/cash-sessions/current",
        "/api/expenses",
        "/api/inventory",
        "/api/change-requests",
      ];

      for (const path of paths) {
        const res = await apiRequest(path);
        expect(res.status, `${path} must require a session`).toBe(401);
        expect(res.error?.code).toBe("error.unauthorized");
      }
    });

    it("refuses an unauthenticated write, and writes nothing", async () => {
      const before = await readStock(admin, product.id);

      const sold = await apiRequest("/api/orders", {
        method: "POST",
        body: { channel: "STORE", items: [{ productId: product.id, quantity: 1 }] },
      });
      expect(sold.status).toBe(401);

      const drawer = await apiRequest("/api/cash-sessions", {
        method: "POST",
        body: { date: allocateDate(), tzOffset: 0, openingFloat: "1.00" },
      });
      expect(drawer.status).toBe(401);

      expectCount(await readStock(admin, product.id), before, "stock after an unauthenticated sale attempt");
    });
  });
});
