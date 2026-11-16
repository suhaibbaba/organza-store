import type { ProductDto, ProductVariantDto } from "@tests/types/product";

// Shapes the verification suite works with (tests/support/verify.ts) and the
// shapes its runner reads back (backend/scripts/verify.ts).

/** A throwaway product built to a known price, cost and stock. */
export interface SoldItem {
  productId: string;
  variantId?: string;
  quantity: number;
  discountType?: "PERCENT" | "AMOUNT" | null;
  discountValue?: string | null;
}

export interface PricedProduct {
  product: ProductDto;
  id: string;
  basePrice: string;
  cost: string | null;
  stock: number;
}

export interface PricedVariantProduct extends PricedProduct {
  /** The variant carrying an explicit price/cost override. */
  overridden: ProductVariantDto;
  /** The variant with nothing set, which must inherit from the parent. */
  inheriting: ProductVariantDto;
}

// --- what the runner reads --------------------------------------------------

export interface AreaResult {
  key: string;
  title: string;
  claim: string;
  files: string[];
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  failures: { file: string; name: string; message: string }[];
}

export interface VerifyRunSummary {
  /**
   * The run ended badly without a single assertion failing — a test file that
   * could not load reports every test as skipped, and calling that a pass
   * would be the worst lie this tool could tell.
   */
  incomplete: boolean;
  target: { url: string; host: string; kind: string };
  startedAt: string;
  durationMs: number;
  passed: number;
  failed: number;
  skipped: number;
  areas: AreaResult[];
}
