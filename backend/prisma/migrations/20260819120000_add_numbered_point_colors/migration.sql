-- Numbered shawls (spec.md "Numbered shawls"): per-product colour for the
-- numbers drawn on the photo, and the brightness reading the automatic
-- suggestion is based on.
--
-- All three are nullable with no default on purpose: NULL on the product
-- means "follow the photo" (the suggestion), and NULL on an image means
-- "never measured" — every photograph uploaded before this migration — which
-- resolves to the marker this feature shipped with. Nothing existing changes
-- appearance until somebody chooses a colour or re-uploads a photo.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "pointBackgroundColor" TEXT,
ADD COLUMN     "pointTextColor" TEXT;

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "brightness" DOUBLE PRECISION;
