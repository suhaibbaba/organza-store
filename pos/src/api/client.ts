// ─────────────────────────────────────────────
//  Medusa v2 API client
//  • Uses Store API for product lookup (needs prices)
//  • Uses Admin API for login + order creation
// ─────────────────────────────────────────────
import { loadSettings, loadToken, saveToken } from "@/lib/storage";
import type { Product, Region, SalesChannel, Category } from "@/types";

// ── Base fetch ────────────────────────────────
async function request<T>(
  path: string,
  options: RequestInit & { useAdmin?: boolean } = {},
): Promise<T> {
  const settings = loadSettings();
  const token = loadToken();
  const { useAdmin = true, headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string> | undefined),
  };

  if (useAdmin && token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (!useAdmin && settings.publishableKey) {
    headers["x-publishable-api-key"] = settings.publishableKey;
  }

  const res = await fetch(`${settings.backendUrl}${path}`, {
    ...rest,
    headers,
  });

  if (res.status === 401) {
    saveToken(null);
    throw new Error("unauthorized");
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.message || body.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

// ── AUTH ───────────────────────────────────────
export async function login(email: string, password: string): Promise<void> {
  const settings = loadSettings();
  const res = await fetch(`${settings.backendUrl}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("login_failed");
  const { token } = (await res.json()) as { token: string };
  saveToken(token);
}

export function logout(): void {
  saveToken(null);
}

export function isLoggedIn(): boolean {
  return !!loadToken();
}

// ── REGIONS / SALES CHANNELS (Admin) ───────────
export async function getRegions(): Promise<Region[]> {
  const data = await request<{ regions: Region[] }>(
    "/admin/regions?limit=20&fields=id,name,currency_code,countries.iso_2",
  );
  return data.regions;
}

export async function getSalesChannels(): Promise<SalesChannel[]> {
  const data = await request<{ sales_channels: SalesChannel[] }>(
    "/admin/sales-channels?limit=20&fields=id,name",
  );
  return data.sales_channels;
}

// ── PRODUCT LOOKUP (Store API — returns calculated_price) ──
function buildProductQuery(q: string, regionId: string | null): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("limit", "20");
  params.set("fields", "*variants,*variants.calculated_price,thumbnail,handle");
  if (regionId) params.set("region_id", regionId);
  return params.toString();
}

/** Find by exact barcode OR SKU match. Returns null if nothing matches. */
export async function findByCode(
  code: string,
): Promise<{ product: Product; variant: Product["variants"][number] } | null> {
  const settings = loadSettings();
  if (!settings.publishableKey) {
    throw new Error("missing_publishable_key");
  }

  const qs = buildProductQuery(code, settings.regionId);
  const data = await request<{ products: Product[] }>(`/store/products?${qs}`, {
    useAdmin: false,
  });

  for (const product of data.products) {
    for (const variant of product.variants) {
      if (variant.barcode === code || variant.sku === code) {
        return { product, variant };
      }
    }
  }
  return null;
}

/** Partial-match product search (for the manual search modal). */
export async function searchProducts(query: string): Promise<Product[]> {
  const settings = loadSettings();
  if (!query || query.length < 2) return [];
  if (!settings.publishableKey) throw new Error("missing_publishable_key");

  const qs = buildProductQuery(query, settings.regionId);
  const data = await request<{ products: Product[] }>(`/store/products?${qs}`, {
    useAdmin: false,
  });
  return data.products;
}

export async function getCategories(): Promise<Category[]> {
  const data = await request<{ product_categories: Category[] }>(
    "/store/product-categories?limit=100&fields=id,name,handle,rank",
    { useAdmin: false },
  );
  return data.product_categories ?? [];
}

/** Paginated product fetch filtered by category ID */
export async function getProductsByCategory(
  categoryId: string,
  offset: number,
  limit = 20,
): Promise<{ products: Product[]; count: number }> {
  const settings = loadSettings();
  const params = new URLSearchParams();
  params.set("category_id[]", categoryId);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("fields", "*variants,*variants.calculated_price,thumbnail,handle");
  if (settings.regionId) params.set("region_id", settings.regionId);

  const data = await request<{ products: Product[]; count: number }>(
    `/store/products?${params.toString()}`,
    { useAdmin: false },
  );
  return { products: data.products ?? [], count: data.count ?? 0 };
}

// ── ORDER CREATION (Admin) ─────────────────────
export interface CreateOrderInput {
  items: {
    variant_id: string;
    quantity: number;
    unit_price: number; // in cents
  }[];
  regionId: string;
  salesChannelId: string | null;
  paymentMethod: string;
  cartDiscount: number;
}

export async function createOrder(
  input: CreateOrderInput,
): Promise<{ id: string; display_id?: number }> {
  const draftBody = {
    email: "pos@walk-in.local",
    region_id: input.regionId,
    sales_channel_id: input.salesChannelId,
    items: input.items,
    shipping_address: {
      first_name: "Walk-in",
      last_name: "Customer",
      address_1: "POS",
      city: "POS",
      country_code: "us",
      postal_code: "00000",
    },
    billing_address: {
      first_name: "Walk-in",
      last_name: "Customer",
      address_1: "POS",
      city: "POS",
      country_code: "us",
      postal_code: "00000",
    },
    metadata: {
      pos_sale: "true",
      payment_method: input.paymentMethod,
      cart_discount: String(input.cartDiscount),
    },
  };

  const draft = await request<{ draft_order: { id: string } }>(
    "/admin/draft-orders",
    { method: "POST", body: JSON.stringify(draftBody) },
  );

  const completed = await request<{
    order: { id: string; display_id?: number };
  }>(`/admin/draft-orders/${draft.draft_order.id}/convert-to-order`, {
    method: "POST",
  });

  return completed.order;
}

// ── Helper: extract price from a variant ───────
export function getVariantPrice(variant: Product["variants"][number]): number {
  if (variant.calculated_price?.calculated_amount != null) {
    return variant.calculated_price.calculated_amount;
  }
  if (variant.prices && variant.prices.length > 0) {
    return variant.prices[0].amount / 100;
  }
  return 0;
}
