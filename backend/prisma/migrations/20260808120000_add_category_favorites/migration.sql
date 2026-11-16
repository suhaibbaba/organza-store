-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isFavorite" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Category_isFavorite_idx" ON "Category"("isFavorite");
