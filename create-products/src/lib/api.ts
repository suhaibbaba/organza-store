import { getBackendUrl, getToken, setToken } from "./storage";
import type { Product, Variant, Collection } from "@/types";

export interface Category {
  id: string;
  name: string;
  handle: string;
  parent_category_id: string | null;
  category_children?: Category[];
}

export interface ProductType {
  id: string;
  value: string;
}

// ── Core fetch ──────────────────────────────────────────────
async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getBackendUrl() || "http://localhost:9000";
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (!(init.body instanceof FormData))
    headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const pubKey = (await import("./storage")).getPublishableKey();
  if (pubKey) {
    headers["x-publishable-api-key"] = pubKey;
  }
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (res.status === 401) {
    setToken(null);
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const b = await res.json();
      msg = b.message || b.error || msg;
    } catch {
      /**/
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ── AUTH ────────────────────────────────────────────────────
export async function login(
  backendUrl: string,
  email: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${backendUrl}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  const { token } = (await res.json()) as { token: string };
  return token;
}

// ── PRODUCTS ────────────────────────────────────────────────
const PRODUCT_FIELDS =
  "*variants,*variants.prices,*options,*options.values,*images,*collection,*categories,*type";

export async function getProducts(
  q = "",
  offset = 0,
): Promise<{ products: Product[]; count: number }> {
  const params = new URLSearchParams({
    limit: "25",
    offset: String(offset),
    fields: PRODUCT_FIELDS,
  });
  if (q) params.set("q", q);
  return req(`/admin/products?${params}`);
}

export async function getProduct(id: string): Promise<Product> {
  const data = await req<{ product: Product }>(
    `/admin/products/${id}?fields=${PRODUCT_FIELDS}`,
  );
  return data.product;
}

export interface CreateProductInput {
  title: string;
  subtitle?: string;
  description?: string;
  handle?: string;
  status: "draft" | "published";
  thumbnail?: string;
  images?: { url: string }[];
  collection_id?: string;
  categories?: { id: string }[];
  type_id?: string;
  tags?: { value: string }[];
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  hs_code?: string;
  material?: string;
  origin_country?: string;
  metadata?: Record<string, string>;
  options?: { title: string; values: string[] }[];
  variants?: {
    title: string;
    sku: string;
    barcode: string;
    prices: { currency_code: string; amount: number }[];
    options?: Record<string, string>;
  }[];
}

export async function createProduct(
  body: CreateProductInput,
): Promise<Product> {
  const data = await req<{ product: Product }>("/admin/products", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.product;
}

export async function updateProduct(
  id: string,
  body: Partial<CreateProductInput>,
): Promise<Product> {
  const data = await req<{ product: Product }>(`/admin/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return data.product;
}

// ── OPTIONS ─────────────────────────────────────────────────
export async function createOption(
  productId: string,
  title: string,
): Promise<{ id: string; title: string }> {
  const data = await req<{ product_option: { id: string; title: string } }>(
    `/admin/products/${productId}/options`,
    { method: "POST", body: JSON.stringify({ title }) },
  );
  return data.product_option;
}

export async function deleteOption(
  productId: string,
  optionId: string,
): Promise<void> {
  await req(`/admin/products/${productId}/options/${optionId}`, {
    method: "DELETE",
  });
}

// ── VARIANTS ────────────────────────────────────────────────
export interface VariantInput {
  title?: string;
  sku?: string;
  barcode?: string;
  prices?: { currency_code: string; amount: number }[];
  options?: Record<string, string>;
}

export async function createVariant(
  productId: string,
  body: VariantInput,
): Promise<Variant> {
  const data = await req<{ variant: Variant }>(
    `/admin/products/${productId}/variants`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.variant;
}

export async function updateVariant(
  productId: string,
  variantId: string,
  body: Partial<VariantInput>,
): Promise<Variant> {
  const data = await req<{ variant: Variant }>(
    `/admin/products/${productId}/variants/${variantId}`,
    { method: "PUT", body: JSON.stringify(body) },
  );
  return data.variant;
}

export async function deleteVariant(
  productId: string,
  variantId: string,
): Promise<void> {
  await req(`/admin/products/${productId}/variants/${variantId}`, {
    method: "DELETE",
  });
}

// ── UPLOAD ──────────────────────────────────────────────────
export async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("files", file);
  const data = await req<{ uploads: { url: string }[] }>("/admin/uploads", {
    method: "POST",
    body: form,
  });
  return data.uploads[0].url;
}

// ── COLLECTIONS ─────────────────────────────────────────────
export async function getCollections(): Promise<Collection[]> {
  const data = await req<{ collections: Collection[] }>(
    "/admin/collections?limit=100",
  );
  return data.collections;
}

export async function createCollection(title: string): Promise<Collection> {
  const data = await req<{ collection: Collection }>("/admin/collections", {
    method: "POST",
    body: JSON.stringify({
      title,
      handle: title.toLowerCase().replace(/\s+/g, "-"),
    }),
  });
  return data.collection;
}

// ── CATEGORIES ──────────────────────────────────────────────
export async function getCategories(): Promise<Category[]> {
  const data = await req<{ product_categories: Category[] }>(
    "/admin/product-categories?limit=100&include_descendants_tree=true",
  );
  return data.product_categories;
}

export async function createCategory(
  name: string,
  parentId?: string,
): Promise<Category> {
  const data = await req<{ product_category: Category }>(
    "/admin/product-categories",
    {
      method: "POST",
      body: JSON.stringify({
        name,
        handle: name.toLowerCase().replace(/\s+/g, "-"),
        parent_category_id: parentId || null,
      }),
    },
  );
  return data.product_category;
}

// ── PRODUCT TYPES ────────────────────────────────────────────
export async function getProductTypes(): Promise<ProductType[]> {
  const data = await req<{ product_types: ProductType[] }>(
    "/admin/product-types?limit=100",
  );
  return data.product_types;
}

export async function createProductType(value: string): Promise<ProductType> {
  const data = await req<{ product_type: ProductType }>(
    "/admin/product-types",
    {
      method: "POST",
      body: JSON.stringify({ value }),
    },
  );
  return data.product_type;
}

// ── STOCK ────────────────────────────────────────────────────
// Medusa v2: inventory_quantity is NOT a variant field.
// Stock lives in inventory items + location levels.
export async function quickUpdateStock(
  productId: string,
  variantId: string,
  quantity: number,
): Promise<void> {
  try {
    // 1. Get the variant's linked inventory item
    const varData = await req<{
      variant: { inventory_items?: { inventory_item_id: string }[] };
    }>(
      `/admin/products/${productId}/variants/${variantId}?fields=*inventory_items`,
    );
    const itemId = varData.variant?.inventory_items?.[0]?.inventory_item_id;
    if (!itemId) {
      console.warn("No inventory item found for variant", variantId);
      return;
    }

    // 2. Get first stock location
    const locData = await req<{ stock_locations: { id: string }[] }>(
      "/admin/stock-locations?limit=1",
    );
    const locationId = locData.stock_locations?.[0]?.id;
    if (!locationId) {
      console.warn("No stock location configured");
      return;
    }

    // 3. Check if level already exists
    const levData = await req<{ inventory_levels: { id: string }[] }>(
      `/admin/inventory-items/${itemId}/location-levels?location_id=${locationId}`,
    );

    if ((levData.inventory_levels?.length ?? 0) > 0) {
      // Update existing level
      await req(
        `/admin/inventory-items/${itemId}/location-levels/${locationId}`,
        {
          method: "POST",
          body: JSON.stringify({ stocked_quantity: quantity }),
        },
      );
    } else {
      // Create new level
      await req(`/admin/inventory-items/${itemId}/location-levels`, {
        method: "POST",
        body: JSON.stringify({
          location_id: locationId,
          stocked_quantity: quantity,
        }),
      });
    }
  } catch (e) {
    console.warn("Stock update skipped (no inventory module?):", e);
  }
}
