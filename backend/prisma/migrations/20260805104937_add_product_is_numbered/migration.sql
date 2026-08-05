-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isNumbered" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: until now "this is a numbered product" was inferred from the
-- product using the global Number variant type (spec.md "Numbered shawls").
-- The flag replaces that inference, so every product the old rule counted as
-- numbered is marked as one here — otherwise their numbers would stop being
-- offered at the counter the moment this column landed.
UPDATE "Product" AS p
SET "isNumbered" = true
WHERE EXISTS (
  SELECT 1
  FROM "ProductVariantType" AS pvt
  JOIN "VariantType" AS vt ON vt."id" = pvt."variantTypeId"
  WHERE pvt."productId" = p."id" AND vt."slug" = 'number'
);
