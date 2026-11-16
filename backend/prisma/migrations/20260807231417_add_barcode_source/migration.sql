-- CreateEnum
CREATE TYPE "BarcodeSource" AS ENUM ('GENERATED', 'SUPPLIER');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "barcodeSource" "BarcodeSource" NOT NULL DEFAULT 'GENERATED',
ADD COLUMN     "generatedBarcode" TEXT;

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "barcodeSource" "BarcodeSource" NOT NULL DEFAULT 'GENERATED',
ADD COLUMN     "generatedBarcode" TEXT;
