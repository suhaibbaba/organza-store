import { z } from "zod";
import { paginationSchema } from "./common";

const sortFields = ["stock", "sku", "createdAt"] as const;

export const listInventoryQuerySchema = paginationSchema.extend({
  categoryId: z.string().min(1).optional(),
  lowStock: z.coerce.boolean().optional(),
  q: z.string().min(1).optional(),
  sortBy: z.enum(sortFields).default("stock"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});
export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;

export const adjustStockSchema = z.object({
  stock: z.coerce.number().int().min(0, "error.validation.invalid_number"),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
