import { z } from "zod";
import { decimalInput, i18nOptionalSchema, i18nSchema, paginationSchema } from "@/schemas/common";
import { ERROR_CODES } from "@/constants/errors";
import { PRODUCT_SORT_FIELDS } from "@/constants/product";

export const optionSelectionSchema = z.object({
  variantTypeId: z.string().min(1),
  valueIds: z.array(z.string().min(1)).min(1),
});

export const createProductSchema = z.object({
  name: i18nSchema,
  description: i18nOptionalSchema.optional(),
  categoryId: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  basePrice: decimalInput,
  compareAtPrice: decimalInput.optional(),
  cost: decimalInput.optional(),
  isActive: z.boolean().optional(),
  sku: z.string().min(1).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  // Selected global option values to generate variants from (cartesian
  // product across each type's valueIds). Omit for a simple product.
  optionSelections: z.array(optionSelectionSchema).optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  name: i18nSchema.optional(),
  description: i18nOptionalSchema.optional().nullable(),
  categoryId: z.string().min(1).optional(),
  basePrice: decimalInput.optional(),
  compareAtPrice: decimalInput.optional().nullable(),
  cost: decimalInput.optional().nullable(),
  isActive: z.boolean().optional(),
  sku: z.string().min(1).optional(),
  stock: z.coerce.number().int().min(0).optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const generateVariantsSchema = z.object({
  optionSelections: z.array(optionSelectionSchema).min(1),
});
export type GenerateVariantsInput = z.infer<typeof generateVariantsSchema>;

export const updateVariantSchema = z.object({
  name: i18nSchema.optional(),
  sku: z.string().min(1).optional(),
  priceOverride: decimalInput.optional().nullable(),
  cost: decimalInput.optional().nullable(),
  stock: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export const listProductsQuerySchema = paginationSchema.extend({
  categoryId: z.string().min(1).optional(),
  status: z.enum(["active", "hidden"]).optional(),
  stock: z.enum(["in_stock", "out_of_stock"]).optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  q: z.string().min(1).optional(),
  sortBy: z.enum(PRODUCT_SORT_FIELDS).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
