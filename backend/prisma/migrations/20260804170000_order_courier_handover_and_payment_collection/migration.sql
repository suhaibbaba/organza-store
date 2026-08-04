-- Orders, part 2: how the shop really works.
--
-- 1) Status flow. The shop's involvement in an online order ends when the
--    parcel is given to the delivery company — it does not track the drive to
--    the customer's door — so DELIVERING and RECEIVED are replaced by a
--    single final HANDED_TO_COURIER. Existing rows in either of those states
--    are past the handover, so both map onto it.
-- 2) Payment collection. Money for a courier order arrives later, from the
--    delivery company, so being sold and being paid become two facts.
--    Existing counter sales were paid in cash at the till and are backfilled
--    as collected; everything else is still owed.

-- --- 1) OrderStatus: drop DELIVERING/RECEIVED, add HANDED_TO_COURIER -------
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";

CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'PREPARING', 'HANDED_TO_COURIER', 'COMPLETED', 'CANCELLED', 'RETURNED');

ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Order"
  ALTER COLUMN "status" TYPE "OrderStatus"
  USING (
    CASE "status"::text
      WHEN 'DELIVERING' THEN 'HANDED_TO_COURIER'
      WHEN 'RECEIVED' THEN 'HANDED_TO_COURIER'
      ELSE "status"::text
    END
  )::"OrderStatus";

ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'NEW';

DROP TYPE "OrderStatus_old";

-- --- 2) Payment collection ------------------------------------------------
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING_COLLECTION', 'COLLECTED');

ALTER TABLE "Order" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING_COLLECTION';
ALTER TABLE "Order" ADD COLUMN "collectedAt" TIMESTAMP(3);

-- A counter sale is cash in hand the moment it is rung up, so every existing
-- STORE order is already collected — as of when it was taken.
UPDATE "Order"
SET "paymentStatus" = 'COLLECTED', "collectedAt" = "createdAt"
WHERE "channel" = 'STORE';

CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- --- 3) Audit trail for collections ---------------------------------------
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_COLLECTED';
