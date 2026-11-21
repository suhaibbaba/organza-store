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
}

export interface GlobalSearchGroup {
  key: GlobalSearchGroupKey;
  items: GlobalSearchItem[];
  total: number;
  seeAllHref?: string;
}
