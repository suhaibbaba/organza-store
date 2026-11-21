import type { Product } from "@store/shared/types/product";
import type { Variant } from "@store/shared/types/variant";

// A simple product or one variant, never a bare parent: it owns neither the price nor the stock.
export interface SellableItem {
  product: Product;
  variant: Variant | null;
}

// A code naming the variant itself asks nothing; a parent code still needs a choice.
export type PickerSource = "search" | "code";
