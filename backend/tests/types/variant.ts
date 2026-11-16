import type { z } from "zod";
import type { optionSelectionSchema } from "@/validation/product";

// Reuses the backend's own Zod schema for the create/generate-variants
// request shape instead of hand-typing the same fields again.
export type OptionSelection = z.infer<typeof optionSelectionSchema>;

// GET /api/variant-types response shape (backend/src/routes/variantTypes.ts
// returns the raw Prisma rows via `include`, with no named response type).
export interface VariantOptionValueDto {
  id: string;
  // Slugified from the Arabic value — what uniqueness is keyed on, never the
  // translated text itself (CLAUDE.md rule 9).
  key?: string;
  value?: { ar: string; en?: string; he?: string };
}

export interface VariantTypeDto {
  id: string;
  slug: string;
  name?: { ar: string; en?: string; he?: string };
  values: VariantOptionValueDto[];
}
