-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'REQUEST';
ALTER TYPE "AuditAction" ADD VALUE 'SUPERSEDE';

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "pendingKey" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "entityLabel" JSONB,
    "entityDetail" TEXT,
    "productId" TEXT,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChangeRequest_pendingKey_key" ON "ChangeRequest"("pendingKey");

-- CreateIndex
CREATE INDEX "ChangeRequest_status_requestedAt_idx" ON "ChangeRequest"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "ChangeRequest_entityType_entityId_status_idx" ON "ChangeRequest"("entityType", "entityId", "status");

-- CreateIndex
CREATE INDEX "ChangeRequest_productId_status_idx" ON "ChangeRequest"("productId", "status");

-- CreateIndex
CREATE INDEX "ChangeRequest_requestedById_idx" ON "ChangeRequest"("requestedById");

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Lift the existing expense approvals into the generic flow.
--
-- Expenses keep their own approvalStatus/approvedBy columns: those are the
-- APPLIED state, written by an approval, exactly as Product.basePrice is the
-- applied state of a price request. What moves here is the REQUEST — the
-- thing an Admin acts on — so that there is one approval mechanism instead of
-- two endpoints that happen to do the same job.
--
-- Nothing is approved, rejected or dropped by this backfill: every row keeps
-- the status it already had, and a request row is written alongside it so the
-- pending queue picks up exactly the expenses that were already waiting.
--
-- Only expenses that genuinely went through a request are backfilled:
--   * PENDING  — still waiting; these are the live queue, so they get a
--                pendingKey and show up on the approval screen immediately.
--   * REJECTED — somebody turned it down; the decision is preserved.
--   * APPROVED by someone OTHER than whoever recorded it — signed off.
-- An expense an Admin/Manager recorded and self-approved was never a request
-- (spec.md: they could approve it anyway), so inventing one would only put
-- noise in the history.
-- Soft-deleted expenses are skipped: they are hidden everywhere else, and a
-- deleted expense must not put a live request on anyone's screen.
-- ---------------------------------------------------------------------------
INSERT INTO "ChangeRequest" (
    "id", "entityType", "entityId", "field", "pendingKey",
    "oldValue", "newValue", "entityLabel", "entityDetail", "productId",
    "status", "requestedById", "requestedAt",
    "decidedById", "decidedAt", "decisionNote", "createdAt", "updatedAt"
)
SELECT
    'mig' || replace(gen_random_uuid()::text, '-', ''),
    'Expense',
    e."id",
    'approvalStatus',
    -- Set only while pending — the unique index on it is what stops a second
    -- pending request ever queueing up behind the first.
    CASE WHEN e."approvalStatus" = 'PENDING' THEN 'Expense:' || e."id" || ':approvalStatus' END,
    jsonb_build_object('kind', 'approval', 'value', 'PENDING'),
    jsonb_build_object('kind', 'approval', 'value', 'APPROVED'),
    -- Same snapshot the live flow takes: which category, and how much.
    c."name",
    e."amount"::text,
    NULL,
    CASE e."approvalStatus"
        WHEN 'PENDING'  THEN 'PENDING'::"ChangeRequestStatus"
        WHEN 'APPROVED' THEN 'APPROVED'::"ChangeRequestStatus"
        ELSE 'REJECTED'::"ChangeRequestStatus"
    END,
    e."createdById",
    e."createdAt",
    CASE WHEN e."approvalStatus" = 'PENDING' THEN NULL ELSE e."approvedById" END,
    CASE WHEN e."approvalStatus" = 'PENDING' THEN NULL ELSE e."approvedAt" END,
    NULL,
    e."createdAt",
    COALESCE(e."updatedAt", e."createdAt")
FROM "Expense" e
JOIN "ExpenseCategory" c ON c."id" = e."categoryId"
WHERE e."deletedAt" IS NULL
  AND (
        e."approvalStatus" = 'PENDING'
     OR e."approvalStatus" = 'REJECTED'
     OR (e."approvalStatus" = 'APPROVED' AND e."approvedById" IS DISTINCT FROM e."createdById")
  );
