import { z } from "zod";
import { paginationSchema } from "@/schemas/common";
import { ERROR_CODES } from "@/constants/errors";
import { INVENTORY_SORT_FIELDS } from "@/constants/inventory";

export const listInventoryQuerySchema = paginationSchema.extend({
  categoryId: z.string().min(1).optional(),
  lowStock: z.coerce.boolean().optional(),
  q: z.string().min(1).optional(),
  sortBy: z.enum(INVENTORY_SORT_FIELDS).default("stock"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});
export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;

export const adjustStockSchema = z.object({
  stock: z.coerce.number().int().min(0, ERROR_CODES.VALIDATION_INVALID_NUMBER),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
