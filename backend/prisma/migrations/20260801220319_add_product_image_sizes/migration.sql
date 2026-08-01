/*
  Warnings:

  - Added the required column `filename` to the `ProductImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mediumUrl` to the `ProductImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `thumbnailUrl` to the `ProductImage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "filename" TEXT NOT NULL,
ADD COLUMN     "mediumUrl" TEXT NOT NULL,
ADD COLUMN     "thumbnailUrl" TEXT NOT NULL;
