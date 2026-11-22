-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_RECEIVED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_REFUNDED';
ALTER TYPE "AuditAction" ADD VALUE 'HANDED_OVER';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'ON_CREDIT';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "onCredit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "handedOverAt" TIMESTAMP(3),
ADD COLUMN     "handedOverById" TEXT;

-- CreateTable
CREATE TABLE "OrderPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "receivedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderPayment_orderId_idx" ON "OrderPayment"("orderId");

-- CreateIndex
CREATE INDEX "OrderPayment_receivedAt_idx" ON "OrderPayment"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_onCredit_idx" ON "Order"("onCredit");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_handedOverById_fkey" FOREIGN KEY ("handedOverById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Link past orders to customers: one per phone, both Palestine prefixes as one, details from the newest order.
WITH keyed AS (
  SELECT o.*,
         CASE WHEN o."customerPhone" ~ '^\+97[02]' THEN '+970' || substr(o."customerPhone", 5) ELSE o."customerPhone" END AS phone_key
  FROM "Order" o
  WHERE o."customerPhone" IS NOT NULL AND o."customerName" IS NOT NULL AND o."deletedAt" IS NULL
),
newest AS (
  SELECT DISTINCT ON (phone_key) *
  FROM keyed
  ORDER BY phone_key, "createdAt" DESC
)
INSERT INTO "Customer" (id, name, phone, whatsapp, address, latitude, longitude, "createdById", "createdAt", "updatedAt")
SELECT 'c' || replace(gen_random_uuid()::text, '-', ''), "customerName", "customerPhone", "customerWhatsapp", "customerAddress",
       "customerLatitude", "customerLongitude", "createdById", "createdAt", now()
FROM newest;

UPDATE "Order" o
SET "customerId" = c.id
FROM "Customer" c
WHERE o."customerPhone" IS NOT NULL
  AND (CASE WHEN o."customerPhone" ~ '^\+97[02]' THEN '+970' || substr(o."customerPhone", 5) ELSE o."customerPhone" END)
    = (CASE WHEN c.phone ~ '^\+97[02]' THEN '+970' || substr(c.phone, 5) ELSE c.phone END);
