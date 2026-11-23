-- CreateEnum
CREATE TYPE "ExchangeSettlement" AS ENUM ('EVEN', 'PAID', 'DEBT', 'WAIVED', 'REFUNDED', 'KEPT');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'EXCHANGE';

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'EXCHANGE';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "exchangeCredit" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "exchangeKept" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "exchangeOfOrderId" TEXT,
ADD COLUMN     "exchangeSettlement" "ExchangeSettlement";

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "exchangedQuantity" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Order_exchangeOfOrderId_idx" ON "Order"("exchangeOfOrderId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_exchangeOfOrderId_fkey" FOREIGN KEY ("exchangeOfOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
