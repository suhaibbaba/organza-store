import type { Prisma } from "@prisma/client";
import type { SEARCH_ENGINES, SEARCH_PRODUCT_INCLUDE } from "@/constants/search";

export type SearchEngineName = (typeof SEARCH_ENGINES)[keyof typeof SEARCH_ENGINES];

export interface MeilisearchConfig {
  host: string;
  apiKey: string | null;
  index: string;
}

// One document per product; name_<lang> fields come from SUPPORTED_LANGUAGES.
export interface ProductSearchDocument {
  id: string;
  [nameField: `name_${string}`]: string;
  sku: string[];
  barcode: string[];
  category: string;
  attributes: string;
  description: string;
  categoryId: string | null;
  isActive: boolean;
  inStock: boolean;
  price: number;
  image: string | null;
  createdAt: number;
}

export type SearchProductRow = Prisma.ProductGetPayload<{ include: typeof SEARCH_PRODUCT_INCLUDE }>;

export interface SearchCategoryNode {
  id: string;
  name: unknown;
  parentId: string | null;
}

export interface ProductSearchOptions {
  limit?: number;
  // The customer site only ever sees products on the shelf.
  activeOnly?: boolean;
}

export interface MeilisearchTask {
  taskUid: number;
}

export interface MeilisearchTaskStatus {
  uid: number;
  status: string;
  error?: { code?: string; message?: string } | null;
}

export interface SearchEngineStatus {
  engine: SearchEngineName;
  reachable: boolean;
}

export interface ReindexSummary {
  engine: SearchEngineName;
  indexed: number;
}
