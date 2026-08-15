-- CreateEnum
CREATE TYPE "BackupRunStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "BackupRun" (
    "id" TEXT NOT NULL,
    "status" "BackupRunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "destination" TEXT,
    "databaseBytes" BIGINT,
    "imageCount" INTEGER,
    "imageBytes" BIGINT,
    "failedStage" TEXT,
    "error" TEXT,

    CONSTRAINT "BackupRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackupRun_status_finishedAt_idx" ON "BackupRun"("status", "finishedAt");

-- CreateIndex
CREATE INDEX "BackupRun_finishedAt_idx" ON "BackupRun"("finishedAt");
