-- AlterTable
ALTER TABLE "ChangeRequest" ADD COLUMN     "productLabel" JSONB;

-- ---------------------------------------------------------------------------
-- Name the piece on every request that already has one.
--
-- The approval screen used to draw entityLabel as its heading, which on a
-- VARIANT is the combination's own name ("1", "أحمر / M") — so a stock
-- request read "كمية الخيار · 1 · ORG-00089-1" and the only way to tell WHICH
-- product it was about was to decode the SKU. The product's name lives in its
-- own column now, and the existing rows are filled in from the product they
-- already point at.
--
-- Product.deletedAt is deliberately NOT filtered: a request that outlived its
-- product still has to read correctly on the screen, which is the whole
-- reason these labels are snapshots rather than joins.
--
-- Rows with no productId keep NULL — that is an expense, which has no product
-- behind it and is headed by its category instead.
-- ---------------------------------------------------------------------------
UPDATE "ChangeRequest" cr
SET "productLabel" = p."name"
FROM "Product" p
WHERE p."id" = cr."productId"
  AND cr."productLabel" IS NULL;
