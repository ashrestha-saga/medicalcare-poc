-- AlterTable
ALTER TABLE "User" ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "totpSecretEnc" TEXT;
ALTER TABLE "User" ADD COLUMN "totpVerifiedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "totpBackupHashes" TEXT;
ALTER TABLE "User" ADD COLUMN "totpPendingEnc" TEXT;

-- CreateTable
CREATE TABLE "TotpChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TotpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TotpChallenge_userId_idx" ON "TotpChallenge"("userId");

-- CreateIndex
CREATE INDEX "TotpChallenge_expiresAt_idx" ON "TotpChallenge"("expiresAt");
