-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TenantOxidConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "shopBaseUrl" TEXT,
    "customerNumber" TEXT,
    "companyName" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "lastError" TEXT,
    "connectedAt" DATETIME,
    "connectedByUserId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantOxidConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TenantOxidConnection_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrderRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "raisedBy" TEXT,
    "raisedById" TEXT,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "deliveryAddress" TEXT NOT NULL,
    "note" TEXT,
    "approvalState" TEXT NOT NULL DEFAULT 'pending_approval',
    "state" TEXT NOT NULL DEFAULT 'captured',
    "correlationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderRequest_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderRequest" ("approvalState", "correlationId", "createdAt", "deliveryAddress", "fingerprint", "id", "idempotencyKey", "note", "raisedBy", "reference", "state", "subjectId", "subjectType", "tenantId", "updatedAt") SELECT "approvalState", "correlationId", "createdAt", "deliveryAddress", "fingerprint", "id", "idempotencyKey", "note", "raisedBy", "reference", "state", "subjectId", "subjectType", "tenantId", "updatedAt" FROM "OrderRequest";
DROP TABLE "OrderRequest";
ALTER TABLE "new_OrderRequest" RENAME TO "OrderRequest";
CREATE UNIQUE INDEX "OrderRequest_reference_key" ON "OrderRequest"("reference");
CREATE UNIQUE INDEX "OrderRequest_idempotencyKey_key" ON "OrderRequest"("idempotencyKey");
CREATE INDEX "OrderRequest_tenantId_createdAt_idx" ON "OrderRequest"("tenantId", "createdAt");
CREATE INDEX "OrderRequest_raisedById_idx" ON "OrderRequest"("raisedById");
CREATE TABLE "new_ServiceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "priority" TEXT,
    "note" TEXT,
    "raisedBy" TEXT,
    "raisedById" TEXT,
    "siteId" TEXT,
    "locationText" TEXT NOT NULL,
    "accessHint" TEXT,
    "contact" TEXT,
    "deliveryAddress" TEXT NOT NULL,
    "classification" TEXT,
    "correlationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'captured',
    CONSTRAINT "ServiceRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceRequest_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ServiceRequest" ("accessHint", "classification", "contact", "correlationId", "createdAt", "deliveryAddress", "fingerprint", "id", "idempotencyKey", "locationText", "note", "priority", "raisedBy", "reference", "serviceType", "siteId", "state", "subjectId", "subjectType", "tenantId", "updatedAt") SELECT "accessHint", "classification", "contact", "correlationId", "createdAt", "deliveryAddress", "fingerprint", "id", "idempotencyKey", "locationText", "note", "priority", "raisedBy", "reference", "serviceType", "siteId", "state", "subjectId", "subjectType", "tenantId", "updatedAt" FROM "ServiceRequest";
DROP TABLE "ServiceRequest";
ALTER TABLE "new_ServiceRequest" RENAME TO "ServiceRequest";
CREATE UNIQUE INDEX "ServiceRequest_reference_key" ON "ServiceRequest"("reference");
CREATE UNIQUE INDEX "ServiceRequest_idempotencyKey_key" ON "ServiceRequest"("idempotencyKey");
CREATE INDEX "ServiceRequest_tenantId_createdAt_idx" ON "ServiceRequest"("tenantId", "createdAt");
CREATE INDEX "ServiceRequest_raisedById_idx" ON "ServiceRequest"("raisedById");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "TenantOxidConnection_tenantId_key" ON "TenantOxidConnection"("tenantId");
