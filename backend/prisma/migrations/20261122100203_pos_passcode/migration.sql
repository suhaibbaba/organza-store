-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "posAutoLockMinutes" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "PosDevice" (
    "id" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosDeviceMember" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "lastUnlockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosDeviceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosPasscode" (
    "userId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosPasscode_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "PosDevice_secretHash_key" ON "PosDevice"("secretHash");

-- CreateIndex
CREATE INDEX "PosDeviceMember_userId_idx" ON "PosDeviceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PosDeviceMember_deviceId_userId_key" ON "PosDeviceMember"("deviceId", "userId");

-- AddForeignKey
ALTER TABLE "PosDeviceMember" ADD CONSTRAINT "PosDeviceMember_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "PosDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosDeviceMember" ADD CONSTRAINT "PosDeviceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosPasscode" ADD CONSTRAINT "PosPasscode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
