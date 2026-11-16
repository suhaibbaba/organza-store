// Fixtures for the verification suite.
//
// Every one of them is built from scratch to a KNOWN price, cost and stock,
// and every one is registered for teardown automatically (apiRequest feeds
// tests/support/fixtureRegistry.ts). Nothing here reads the seed's own
// products: an assertion about money has to start from a figure this file
// chose, or it is measuring whatever the sandbox happened to contain.
import { apiRequest, uniqueId } from "@tests/support/client";
import { anyCategoryId } from "@tests/support/fixtures";
import { randomPalestinePhone } from "@tests/support/phone";
import { STOCK_ON_HAND, UNIT_COST, UNIT_PRICE } from "@tests/constants";
import type {
  ApiResult,
  OrderDto,
  PricedProduct,
  PricedVariantProduct,
  ProductDto,
  SoldItem,
  VariantTypeDto,
} from "@tests/types";

// Everything the suite creates carries this in its name, so a leftover is
// recognisable at a glance in the admin if a teardown ever fails to finish.
const MARKER = "verify";

function fixtureName(what: string): { ar: string; en: string } {
  const nonce = uniqueId();
  return { ar: `تحقق ${what} ${nonce}`, en: `[${MARKER}] ${what} ${nonce}` };
}

// --- products ---------------------------------------------------------------

export interface PricedProductOptions {
  basePrice?: string;
  /** null records a product with no cost at all — the missingCostItems case. */
  cost?: string | null;
  stock?: number;
  compareAtPrice?: string;
}

/** A simple (variant-less) product at a price and cost the caller chose. */
export async function createPricedProduct(
  token: string,
  options: PricedProductOptions = {}
): Promise<PricedProduct> {
  const basePrice = options.basePrice ?? UNIT_PRICE;
  const cost = options.cost === undefined ? UNIT_COST : options.cost;
  const stock = options.stock ?? STOCK_ON_HAND;

  const res = await apiRequest<ProductDto>("/api/products", {
    method: "POST",
    token,
    body: {
      name: fixtureName("product"),
      categoryId: await anyCategoryId(token),
      basePrice,
      ...(cost === null ? {} : { cost }),
      ...(options.compareAtPrice ? { compareAtPrice: options.compareAtPrice } : {}),
      stock: String(stock),
    },
  });

  if (res.status !== 201 || !res.data) {
    throw new Error(`Could not create a priced product (HTTP ${res.status}, ${res.error?.code}).`);
  }
  return { product: res.data, id: res.data.id, basePrice, cost, stock };
}

// One option type with two values = two variants, which is all the fallback
// rule needs: one variant that overrides, one that inherits.
async function twoValueSelection(token: string): Promise<{ variantTypeId: string; valueIds: string[] }> {
  const res = await apiRequest<VariantTypeDto[]>("/api/variant-types", { token });
  const colour = res.data?.find((type) => type.slug === "color");
  if (!colour || colour.values.length < 2) {
    throw new Error("The seeded 'color' variant type with >=2 values is required — run `npm run seed`.");
  }
  return { variantTypeId: colour.id, valueIds: [colour.values[0].id, colour.values[1].id] };
}

export interface PricedVariantOptions extends PricedProductOptions {
  priceOverride: string;
  costOverride: string;
  variantStock?: number;
}

/**
 * A product with two variants: the first carries an explicit price AND cost,
 * the second carries neither and must therefore inherit the parent's
 * (CLAUDE.md rule 3 — resolved at read time, never copied).
 */
export async function createVariantProduct(
  token: string,
  options: PricedVariantOptions
): Promise<PricedVariantProduct> {
  const basePrice = options.basePrice ?? UNIT_PRICE;
  const cost = options.cost === undefined ? UNIT_COST : options.cost;
  const stock = options.variantStock ?? STOCK_ON_HAND;

  const created = await apiRequest<ProductDto>("/api/products", {
    method: "POST",
    token,
    body: {
      name: fixtureName("variant product"),
      categoryId: await anyCategoryId(token),
      basePrice,
      ...(cost === null ? {} : { cost }),
      optionSelections: [await twoValueSelection(token)],
    },
  });
  if (created.status !== 201 || created.data?.variants.length !== 2) {
    throw new Error(`Could not create a two-variant product (HTTP ${created.status}, ${created.error?.code}).`);
  }

  const [first, second] = created.data.variants;

  // Only the FIRST variant is given a price and a cost. The second is left
  // untouched on purpose: that is the inheritance under test.
  const patched = await apiRequest(`/api/products/${created.data.id}/variants/${first.id}`, {
    method: "PATCH",
    token,
    body: { priceOverride: options.priceOverride, cost: options.costOverride, stock },
  });
  if (patched.status !== 200) {
    throw new Error(`Could not set the variant's own price/cost (HTTP ${patched.status}).`);
  }

  const stocked = await apiRequest(`/api/products/${created.data.id}/variants/${second.id}`, {
    method: "PATCH",
    token,
    body: { stock },
  });
  if (stocked.status !== 200) throw new Error(`Could not stock the inheriting variant (HTTP ${stocked.status}).`);

  const reloaded = await readProduct(token, created.data.id);
  const overridden = reloaded.variants.find((variant) => variant.id === first.id)!;
  const inheriting = reloaded.variants.find((variant) => variant.id === second.id)!;

  return { product: reloaded, id: reloaded.id, basePrice, cost, stock, overridden, inheriting };
}

export async function readProduct(token: string, id: string): Promise<ProductDto> {
  const res = await apiRequest<ProductDto>(`/api/products/${id}`, { token });
  if (res.status !== 200 || !res.data) throw new Error(`Could not read product ${id} (HTTP ${res.status}).`);
  return res.data;
}

/** A simple product's stock, or one variant's when a variantId is given. */
export async function readStock(token: string, productId: string, variantId?: string): Promise<number> {
  const product = await readProduct(token, productId);
  if (!variantId) {
    if (product.stock === undefined) throw new Error(`Product ${productId} has variants — ask for one of them.`);
    return product.stock;
  }
  const variant = product.variants.find((entry) => entry.id === variantId);
  if (!variant || variant.stock === undefined) throw new Error(`Variant ${variantId} is not on product ${productId}.`);
  return variant.stock;
}

// --- orders -----------------------------------------------------------------

export interface SaleOptions {
  channel?: "STORE" | "WHATSAPP" | "WEBSITE";
  type?: "SALE" | "GIFT";
  discountType?: "PERCENT" | "AMOUNT" | null;
  discountValue?: string | null;
  /** Anything else to send verbatim — including fields the server must ignore. */
  extra?: Record<string, unknown>;
}

/** Contact details for an online order, which the schema requires. */
export function onlineCustomer(): { customerName: string; customerPhone: string } {
  return { customerName: `[${MARKER}] customer ${uniqueId()}`, customerPhone: randomPalestinePhone() };
}

export function sellRequest(
  token: string,
  items: SoldItem[],
  options: SaleOptions = {}
): Promise<ApiResult<OrderDto>> {
  const channel = options.channel ?? "STORE";
  return apiRequest<OrderDto>("/api/orders", {
    method: "POST",
    token,
    body: {
      channel,
      ...(options.type ? { type: options.type } : {}),
      ...(channel === "STORE" ? {} : onlineCustomer()),
      items,
      ...(options.discountType ? { discountType: options.discountType, discountValue: options.discountValue } : {}),
      ...options.extra,
    },
  });
}

/** Rings a sale up and insists it worked, so a test's own arithmetic is what fails. */
export async function sell(token: string, items: SoldItem[], options: SaleOptions = {}): Promise<OrderDto> {
  const res = await sellRequest(token, items, options);
  if (res.status !== 201 || !res.data) {
    throw new Error(`Could not create the order (HTTP ${res.status}, ${res.error?.code}).`);
  }
  return res.data;
}

export function readOrderRequest(token: string, id: string): Promise<ApiResult<OrderDto>> {
  return apiRequest<OrderDto>(`/api/orders/${id}`, { token });
}

export async function readOrder(token: string, id: string): Promise<OrderDto> {
  const res = await readOrderRequest(token, id);
  if (res.status !== 200 || !res.data) throw new Error(`Could not read order ${id} (HTTP ${res.status}).`);
  return res.data;
}

export function setStatus(token: string, id: string, status: string): Promise<ApiResult<OrderDto>> {
  return apiRequest<OrderDto>(`/api/orders/${id}/status`, { method: "PATCH", token, body: { status } });
}

/** Walks an online order all the way to the courier, which is where it ends. */
export async function handToCourier(token: string, id: string): Promise<OrderDto> {
  for (const status of ["PREPARING", "HANDED_TO_COURIER"]) {
    const res = await setStatus(token, id, status);
    if (res.status !== 200) throw new Error(`Could not move order ${id} to ${status} (HTTP ${res.status}).`);
  }
  return readOrder(token, id);
}

export function returnOrderRequest(
  token: string,
  id: string,
  items?: { orderItemId: string; quantity: number }[]
): Promise<ApiResult<OrderDto>> {
  return apiRequest<OrderDto>(`/api/orders/${id}/return`, {
    method: "POST",
    token,
    body: items ? { items } : {},
  });
}

export function collect(token: string, orderIds: string[]): Promise<ApiResult<{ collectedIds: string[]; alreadyCollectedIds: string[] }>> {
  return apiRequest("/api/orders/collect", { method: "POST", token, body: { orderIds } });
}

/** An online sale taken all the way to the courier and left awaiting payment. */
export async function sellOnCredit(token: string, items: SoldItem[], options: SaleOptions = {}): Promise<OrderDto> {
  const order = await sell(token, items, { ...options, channel: options.channel ?? "WHATSAPP" });
  return handToCourier(token, order.id);
}
