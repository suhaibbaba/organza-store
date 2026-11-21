import type { ProductSummary } from "@organza/shared/types/product";
import type { OrderStatus } from "@organza/shared/types/order";

export type GlobalSearchGroupKey = "pages" | "orders" | "products" | "customers";

export interface GlobalSearchItem {
  id: string;
  href: string;
  title: string;
  subtitle?: string;
  meta?: string;
  status?: OrderStatus;
  thumbnailUrl?: string | null;
  // A product result, so a numbered shawl is drawn with its numbers.
  product?: Pick<ProductSummary, "image" | "markedImage">;
}

export interface GlobalSearchGroup {
  key: GlobalSearchGroupKey;
  items: GlobalSearchItem[];
  total: number;
  seeAllHref?: string;
}
