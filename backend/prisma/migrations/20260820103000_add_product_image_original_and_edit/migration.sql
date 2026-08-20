-- The photograph as it arrived, and what the shop did to it.
--
-- Product photos are cropped in the admin now (spec.md "Editing a photograph
-- on upload"): the browser sends the file untouched plus a rectangle, a
-- quarter turn and a mirror, and sharp cuts the three stored sizes out of the
-- original at full quality. Keeping the original is what makes that
-- reversible — a crop can be reconsidered without photographing the piece
-- again — and keeping the edit beside it is what lets the editor re-open
-- where the last person left it.
--
-- All three columns are nullable and nothing backfills them: an image
-- uploaded before this migration has no original on disk, and inventing a
-- filename for a file that does not exist would turn a missing feature into a
-- broken image. Those photos keep working exactly as they did.

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "edit" JSONB,
ADD COLUMN     "originalFilename" TEXT,
ADD COLUMN     "originalUrl" TEXT;
