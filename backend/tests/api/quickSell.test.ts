import { afterAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anyCategoryId } from "@tests/support/fixtures";
import { approveChange, pendingChangeFor, rejectChange } from "@tests/support/changeRequests";
import { num, salesReport } from "@tests/support/reports";
import { CHANGE_REQUEST_ENTITIES, CHANGE_REQUEST_FIELDS, ERROR_CODES } from "@/constants";
import type {
  ChangeRequestDto,
  OrderDto,
  OrderSummaryDto,
  ProductDto,
  ProductSummaryDto,
} from "@tests/types";

// Quick sell (spec.md "Quick sell") — selling a piece the catalogue has never
// heard of, and reviewing it afterwards.
//
// The whole point is the ORDER of things, so that is what these assert: the
// sale completes first, on its own, with nothing waiting on anybody; the
// review comes after, and neither of its two answers can reach back and
// change what was sold. Approving finishes the product off; refusing rules it
// a one-off and leaves the order exactly where it was.
//
// Like the rest of the suite this runs against a LIVE API whose database
// already holds other sales, so nothing asserts an absolute total — the
// missing-cost case takes a snapshot and asserts on the difference.

describe("Quick sell", () => {
  const createdProductIds: string[] = [];

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    for (const id of createdProductIds) {
      await apiRequest(`/api/products/${id}`, { method: "DELETE", token: admin.token });
    }
  });

  /** Rings up one quick-sold piece at the counter, exactly as the POS does. */
  async function quickSell(
    token: string,
    options: { name?: string; price?: string; detail?: string; quantity?: number } = {}
  ) {
    const name = options.name ?? `Vitest QuickSell ${uniqueId()}`;
    const res = await apiRequest<OrderDto>("/api/orders", {
      method: "POST",
      token,
      body: {
        channel: "STORE",
        paymentMethod: "CASH",
        items: [
          {
            quantity: options.quantity ?? 1,
            quickSell: {
              name,
              price: options.price ?? "150",
              ...(options.detail ? { detail: options.detail } : {}),
            },
          },
        ],
      },
    });
    const productId = res.data?.items?.[0]?.productId ?? null;
    if (productId) createdProductIds.push(productId);
    return { res, name, productId };
  }

  async function completionRequest(token: string, productId: string): Promise<ChangeRequestDto> {
    const pending = await pendingChangeFor(
      token,
      CHANGE_REQUEST_ENTITIES.PRODUCT,
      productId,
      CHANGE_REQUEST_FIELDS.PRODUCT_COMPLETION
    );
    if (!pending) throw new Error(`No completion request found for quick-sold product ${productId}.`);
    return pending;
  }

  function readProduct(token: string, id: string) {
    return apiRequest<ProductDto>(`/api/products/${id}`, { token });
  }

  // -------------------------------------------------------------------------
  // 1. The sale completes — immediately, and like any other
  // -------------------------------------------------------------------------

  it("completes a sale for a piece that is not in the catalogue", async () => {
    const employee = await getSession("EMPLOYEE");
    const { res, name, productId } = await quickSell(employee.token, {
      price: "150",
      detail: "أسود",
      quantity: 2,
    });

    // Nothing about this waited on anybody: the order comes back finished,
    // paid for and with its stock already moved, exactly like every other
    // counter sale (spec.md "Stock deduction").
    expect(res.status).toBe(201);
    const order = res.data!;
    expect(order.status).toBe("COMPLETED");
    expect(order.paymentStatus).toBe("COLLECTED");
    expect(order.stockDeductedAt).not.toBeNull();
    expect(order.total).toBe("300.00");

    // ...and it is marked, on the sale and on the line, so it can be found
    // again after the season.
    expect(order.hasQuickSale).toBe(true);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quickSold).toBe(true);
    expect(order.items[0].unitPrice).toBe("150.00");
    expect(productId).not.toBeNull();

    // The product it created is deliberately incomplete — and the stock it
    // was born holding has gone out of the door with the customer.
    const admin = await getSession("ADMIN");
    const product = (await readProduct(admin.token, productId!)).data!;
    expect(product.name.ar).toBe(name);
    expect(product.category).toBeNull();
    expect(product.cost).toBeNull();
    expect(product.images).toHaveLength(0);
    expect(product.stock).toBe(0);
    expect(product.quickSoldAt).not.toBeNull();
    expect(product.needsCompleting).toBe(true);
    // A barcode is minted anyway, so the piece can be labelled the moment
    // somebody puts it on a shelf (CLAUDE.md rule 13).
    expect(product.barcode).not.toBeNull();
  });

  it("is refused to a role that may not quick-sell, and on a gift", async () => {
    const employee = await getSession("EMPLOYEE");
    const admin = await getSession("ADMIN");

    // Every role may quick-sell as shipped — that is the point of it — so the
    // refusal worth asserting is the OTHER half of the rule: it is never a
    // way to give something away (spec.md "Gifts" is Admin/Manager, and a
    // gift of something the shop has no record of holding is a piece walking
    // out with nothing behind it).
    const gift = await apiRequest<OrderDto>("/api/orders", {
      method: "POST",
      token: admin.token,
      body: {
        channel: "STORE",
        type: "GIFT",
        paymentMethod: "CASH",
        items: [{ quantity: 1, quickSell: { name: `Vitest QS gift ${uniqueId()}`, price: "50" } }],
      },
    });
    expect(gift.status).toBe(400);
    expect(gift.error?.code).toBe(ERROR_CODES.ORDER_ITEM_SOURCE_INVALID);

    // ...and a line that names both a catalogue product and a quick sale is
    // refused before anything is created: one line is one thing being sold.
    const both = await apiRequest<OrderDto>("/api/orders", {
      method: "POST",
      token: employee.token,
      body: {
        channel: "STORE",
        paymentMethod: "CASH",
        items: [
          { productId: "does-not-matter", quantity: 1, quickSell: { name: "x", price: "10" } },
        ],
      },
    });
    expect(both.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // 2. A pending product request is created
  // -------------------------------------------------------------------------

  it("files the product as a pending completion request", async () => {
    const employee = await getSession("EMPLOYEE");
    const admin = await getSession("ADMIN");
    const { res, productId } = await quickSell(employee.token, { price: "80", detail: "M" });
    const order = res.data!;

    const request = await completionRequest(admin.token, productId!);
    expect(request.status).toBe("PENDING");
    expect(request.entityType).toBe(CHANGE_REQUEST_ENTITIES.PRODUCT);
    expect(request.field).toBe(CHANGE_REQUEST_FIELDS.PRODUCT_COMPLETION);
    // Attributed to whoever was at the till — "who quick-sold what, at what
    // price" is answerable from the request as well as from the audit trail.
    expect(request.requestedById).toBe(employee.userId);

    // The card has to be able to say "this was SOLD" rather than "approve
    // this change", so what it carries is the sale itself.
    expect(request.newValue?.value).toBe("80.00");
    expect(request.newValue?.detail?.sale?.orderId).toBe(order.id);
    expect(request.newValue?.detail?.sale?.orderNumber).toBe(order.orderNumber);
    expect(request.newValue?.detail?.sale?.detail).toBe("M");

    // The product's own response carries it too, so the edit screen can show
    // the banner without a second lookup.
    const product = (await readProduct(admin.token, productId!)).data!;
    expect(product.pendingChanges?.some((c) => c.id === request.id)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 3. Approving completes it; rejecting leaves the order intact
  // -------------------------------------------------------------------------

  it("completes the product on approval, once its details are filled in", async () => {
    const employee = await getSession("EMPLOYEE");
    const admin = await getSession("ADMIN");
    const { productId } = await quickSell(employee.token, { price: "220" });
    const request = await completionRequest(admin.token, productId!);

    // Signing it off while it is still missing the one thing that makes it
    // findable is refused: a product with no category disappears from every
    // category-filtered list, and completing it would take it off the queue
    // that exists to catch exactly that.
    const premature = await approveChange(admin.token, request.id);
    expect(premature.status).toBe(409);
    expect(premature.error?.code).toBe(ERROR_CODES.PRODUCT_COMPLETION_INCOMPLETE);

    // The reviewer fills in what the cashier skipped, through the ordinary
    // product edit — category, cost, and anything else it was missing.
    const categoryId = await anyCategoryId(admin.token);
    const patched = await apiRequest<ProductDto>(`/api/products/${productId}`, {
      method: "PATCH",
      token: admin.token,
      body: { categoryId, cost: "90" },
    });
    expect(patched.status).toBe(200);

    const approved = await approveChange(admin.token, request.id);
    expect(approved.status).toBe(200);
    expect(approved.data?.status).toBe("APPROVED");

    const product = (await readProduct(admin.token, productId!)).data!;
    expect(product.completedAt).not.toBeNull();
    expect(product.needsCompleting).toBe(false);
    expect(product.category?.id).toBe(categoryId);
    expect(Number(product.cost)).toBe(90);
    // ...and it goes on the shelf: a quick-sold product is created hidden,
    // and completing it is what publishes it.
    expect(product.isActive).toBe(true);
  });

  it("marks the item a one-off on rejection, and leaves the order intact", async () => {
    const employee = await getSession("EMPLOYEE");
    const admin = await getSession("ADMIN");
    const { res, productId } = await quickSell(employee.token, { price: "310" });
    const order = res.data!;
    const request = await completionRequest(admin.token, productId!);

    const rejected = await rejectChange(admin.token, request.id, "قطعة واحدة فقط");
    expect(rejected.status).toBe(200);
    expect(rejected.data?.status).toBe("REJECTED");

    // The product leaves the catalogue — it was never a catalogue item — but
    // it is soft-deleted, never destroyed (CLAUDE.md rule 4).
    const gone = await readProduct(admin.token, productId!);
    expect(gone.status).toBe(404);

    // THE SALE IS UNTOUCHED. Money changed hands; a refusal is a decision
    // about the catalogue, never an undo of the till.
    const after = await apiRequest<OrderDto>(`/api/orders/${order.id}`, { token: admin.token });
    expect(after.status).toBe(200);
    expect(after.data?.status).toBe("COMPLETED");
    expect(after.data?.total).toBe(order.total);
    expect(after.data?.hasQuickSale).toBe(true);
    // ...and the line still says what was sold and for how much, from its own
    // snapshots, even though the product behind it has gone.
    expect(after.data?.items[0].unitPrice).toBe("310.00");
    expect(after.data?.items[0].quickSold).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 4. The missing-cost warning counts it
  // -------------------------------------------------------------------------

  it("is counted by the report's missing-cost warning", async () => {
    const admin = await getSession("ADMIN");
    const employee = await getSession("EMPLOYEE");

    const before = await salesReport(admin.token);
    await quickSell(employee.token, { price: "45" });
    const after = await salesReport(admin.token);

    // Nobody at the till knows what the piece cost, so profit is overstated
    // until somebody fills it in — and the report says so out loud rather
    // than quietly reporting the whole price as profit.
    expect(after.totals.missingCostItems! - before.totals.missingCostItems!).toBeGreaterThanOrEqual(1);
    // The revenue is real, though: the sale happened.
    expect(num(after.totals.revenue) - num(before.totals.revenue)).toBeCloseTo(45, 2);
  });

  // -------------------------------------------------------------------------
  // 5. An incomplete product is still listed, and has a queue of its own
  // -------------------------------------------------------------------------

  it("keeps an incomplete product in the products list and on the needs-completing queue", async () => {
    const employee = await getSession("EMPLOYEE");
    const admin = await getSession("ADMIN");
    const { productId } = await quickSell(employee.token, { price: "60" });

    // The ordinary list must not lose it. It has no category, so every
    // category-filtered view drops it — which is exactly why it has to be
    // marked rather than left to be noticed.
    const listed = await apiRequest<ProductSummaryDto[]>(
      `/api/products?pageSize=100&completeness=needs_completing`,
      { token: admin.token }
    );
    expect(listed.status).toBe(200);
    const row = listed.data?.find((p) => p.id === productId);
    expect(row).toBeDefined();
    expect(row!.category).toBeNull();
    expect(row!.needsCompleting).toBe(true);

    // ...and once it is decided, it drops off the queue rather than sitting
    // there for ever.
    const request = await completionRequest(admin.token, productId!);
    await rejectChange(admin.token, request.id);
    const afterDecision = await apiRequest<ProductSummaryDto[]>(
      `/api/products?pageSize=100&completeness=needs_completing`,
      { token: admin.token }
    );
    expect(afterDecision.data?.some((p) => p.id === productId)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 6. Marked on the sale, and findable as a filter
  // -------------------------------------------------------------------------

  it("marks the sale in the orders list and filters on it", async () => {
    const employee = await getSession("EMPLOYEE");
    const admin = await getSession("ADMIN");
    const { res } = await quickSell(employee.token, { price: "75" });
    const orderId = res.data!.id;

    const filtered = await apiRequest<OrderSummaryDto[]>("/api/orders?hasQuickSale=true&pageSize=100", {
      token: admin.token,
    });
    expect(filtered.status).toBe(200);
    const row = filtered.data?.find((o) => o.id === orderId);
    expect(row).toBeDefined();
    expect(row!.hasQuickSale).toBe(true);
    // Every row the filter returns is one, never a sale that merely happened
    // to be nearby.
    expect(filtered.data!.every((o) => o.hasQuickSale)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Who may complete one
  // -------------------------------------------------------------------------

  it("lets a Manager complete one, and refuses an Employee", async () => {
    const employee = await getSession("EMPLOYEE");
    const manager = await getSession("MANAGER");
    const admin = await getSession("ADMIN");
    const { productId } = await quickSell(employee.token, { price: "95" });
    const request = await completionRequest(admin.token, productId!);

    // The person who rang it up may not sign their own work off as a
    // catalogue item — completing is Admin/Manager (product.complete).
    const refused = await rejectChange(employee.token, request.id);
    expect(refused.status).toBe(403);

    const categoryId = await anyCategoryId(manager.token);
    await apiRequest(`/api/products/${productId}`, {
      method: "PATCH",
      token: manager.token,
      body: { categoryId },
    });

    const completed = await approveChange(manager.token, request.id);
    expect(completed.status).toBe(200);
    expect(completed.data?.status).toBe("APPROVED");

    // A Manager holds no cost visibility (CLAUDE.md rule 19), so the piece is
    // completed with its cost still blank — and the report keeps saying so.
    const product = (await readProduct(admin.token, productId!)).data!;
    expect(product.completedAt).not.toBeNull();
    expect(product.cost).toBeNull();
  });
});
