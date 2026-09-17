-- AlterTable
ALTER TABLE "Site" ADD COLUMN "code" TEXT;
ALTER TABLE "Site" ADD COLUMN "deliveryAddress" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Site_tenantId_code_key" ON "Site"("tenantId", "code");
