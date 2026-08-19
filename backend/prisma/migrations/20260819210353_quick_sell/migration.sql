-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "hasQuickSale" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "quickSold" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "oneOffAt" TIMESTAMP(3),
ADD COLUMN     "quickSoldAt" TIMESTAMP(3),
ALTER COLUMN "categoryId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Order_hasQuickSale_idx" ON "Order"("hasQuickSale");

-- CreateIndex
CREATE INDEX "Product_quickSoldAt_idx" ON "Product"("quickSoldAt");
