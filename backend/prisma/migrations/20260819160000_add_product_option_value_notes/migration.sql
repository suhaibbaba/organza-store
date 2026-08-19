-- What one option value MEANS on one product (spec.md "Notes on a product's
-- options"): "S" is a different measurement on trousers than on an abaya, so
-- the note hangs off the product's USE of the value rather than off the global
-- value the whole catalogue shares.
--
-- Composite primary key (productId, optionValueId): one note per value per
-- product, and the pair is exactly the lookup every read does. Both sides
-- cascade — a deleted product's notes go with it, and a value removed from the
-- global list takes the notes that explained it.

-- CreateTable
CREATE TABLE "ProductOptionValueNote" (
    "productId" TEXT NOT NULL,
    "optionValueId" TEXT NOT NULL,
    "note" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOptionValueNote_pkey" PRIMARY KEY ("productId","optionValueId")
);

-- CreateIndex
CREATE INDEX "ProductOptionValueNote_optionValueId_idx" ON "ProductOptionValueNote"("optionValueId");

-- AddForeignKey
ALTER TABLE "ProductOptionValueNote" ADD CONSTRAINT "ProductOptionValueNote_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOptionValueNote" ADD CONSTRAINT "ProductOptionValueNote_optionValueId_fkey" FOREIGN KEY ("optionValueId") REFERENCES "VariantOptionValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

