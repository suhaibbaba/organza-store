import type { Product } from "@organza/shared/types/product";
import type { Variant } from "@organza/shared/types/variant";

// A resolved, purchasable thing: a simple product, or one variant of a
// variant-bearing product. The selling screen only ever adds one of these
// to the cart — never a bare parent product, which owns neither the price
// nor the stock that gets sold (backend refuses it with
// ORDER_VARIANT_REQUIRED).
export interface SellableItem {
  product: Product;
  variant: Variant | null;
}

// Why the picker is open. A scan/typed code that lands on a variant-bearing
// product still needs the cashier to say which one — unless the code was
// the variant's own, in which case nothing is asked.
export type PickerSource = "search" | "code";
