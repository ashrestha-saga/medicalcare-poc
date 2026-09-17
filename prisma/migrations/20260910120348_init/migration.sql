-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    CONSTRAINT "Site_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Area_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeviceModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "basicUdiDi" TEXT,
    "udiDi" TEXT,
    "gtins" TEXT,
    "manufacturer" TEXT,
    "manufacturerSrn" TEXT,
    "tradeName" TEXT,
    "modelName" TEXT,
    "riskClass" TEXT,
    "emdnCode" TEXT,
    "gmdnCode" TEXT,
    "source" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "state" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExternalSourceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceModelId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL,
    CONSTRAINT "ExternalSourceRecord_deviceModelId_fkey" FOREIGN KEY ("deviceModelId") REFERENCES "DeviceModel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeviceInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "inventoryNumber" TEXT NOT NULL,
    "serialNumber" TEXT,
    "modelId" TEXT,
    "areaId" TEXT,
    "room" TEXT,
    "commissionedAt" DATETIME,
    "responsiblePerson" TEXT,
    "classificationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeviceInstance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeviceInstance_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "DeviceModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DeviceInstance_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DeviceInstance_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "Classification" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CapturedArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "number" TEXT,
    "numberType" TEXT NOT NULL,
    "rawIdentifier" TEXT,
    "nameplateAttachmentId" TEXT,
    "capturedBy" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serviceOnly" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CapturedArticle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Classification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "annex1" BOOLEAN,
    "annex2" BOOLEAN,
    "softwareClass" TEXT,
    "radiation" BOOLEAN,
    "confirmedBy" TEXT,
    "confirmedAt" DATETIME,
    "proposalId" TEXT,
    "overriddenFromProposal" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "ClassificationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchType" TEXT NOT NULL,
    "matchValue" TEXT NOT NULL,
    "annex1" BOOLEAN,
    "annex2" BOOLEAN,
    "softwareClass" TEXT,
    "radiation" BOOLEAN,
    "confidence" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "validFrom" DATETIME,
    "validTo" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ClassificationProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceModelId" TEXT NOT NULL,
    "ruleId" TEXT,
    "annex1" BOOLEAN,
    "annex2" BOOLEAN,
    "softwareClass" TEXT,
    "radiation" BOOLEAN,
    "confidence" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassificationProposal_deviceModelId_fkey" FOREIGN KEY ("deviceModelId") REFERENCES "DeviceModel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
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
    CONSTRAINT "ServiceRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatusEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceRequestId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "actor" TEXT,
    "note" TEXT,
    CONSTRAINT "StatusEvent_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceRequestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DispatchTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "endpoint" TEXT,
    "auth" TEXT,
    "mapping" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "retryPolicy" TEXT,
    CONSTRAINT "DispatchTarget_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DispatchRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceRequestId" TEXT NOT NULL,
    "targetId" TEXT,
    "target" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "httpStatus" INTEGER,
    "response" TEXT,
    "error" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "correlationId" TEXT,
    CONSTRAINT "DispatchRecord_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DispatchRecord_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "DispatchTarget" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "raisedBy" TEXT,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "deliveryAddress" TEXT NOT NULL,
    "note" TEXT,
    "approvalState" TEXT NOT NULL DEFAULT 'pending_approval',
    "state" TEXT NOT NULL DEFAULT 'captured',
    "correlationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderRequestId" TEXT NOT NULL,
    "articleId" TEXT,
    "articleNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL,
    CONSTRAINT "OrderItem_orderRequestId_fkey" FOREIGN KEY ("orderRequestId") REFERENCES "OrderRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExternalCallLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "system" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "correlationId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "success" BOOLEAN NOT NULL,
    "httpStatus" INTEGER,
    "error" TEXT,
    CONSTRAINT "ExternalCallLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Site_tenantId_idx" ON "Site"("tenantId");

-- CreateIndex
CREATE INDEX "Area_siteId_idx" ON "Area"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceModel_basicUdiDi_key" ON "DeviceModel"("basicUdiDi");

-- CreateIndex
CREATE INDEX "DeviceModel_udiDi_idx" ON "DeviceModel"("udiDi");

-- CreateIndex
CREATE INDEX "DeviceModel_manufacturer_modelName_idx" ON "DeviceModel"("manufacturer", "modelName");

-- CreateIndex
CREATE INDEX "ExternalSourceRecord_source_identifier_fetchedAt_idx" ON "ExternalSourceRecord"("source", "identifier", "fetchedAt");

-- CreateIndex
CREATE INDEX "ExternalSourceRecord_deviceModelId_idx" ON "ExternalSourceRecord"("deviceModelId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceInstance_classificationId_key" ON "DeviceInstance"("classificationId");

-- CreateIndex
CREATE INDEX "DeviceInstance_tenantId_serialNumber_idx" ON "DeviceInstance"("tenantId", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceInstance_tenantId_inventoryNumber_key" ON "DeviceInstance"("tenantId", "inventoryNumber");

-- CreateIndex
CREATE INDEX "CapturedArticle_tenantId_idx" ON "CapturedArticle"("tenantId");

-- CreateIndex
CREATE INDEX "ClassificationRule_matchType_matchValue_idx" ON "ClassificationRule"("matchType", "matchValue");

-- CreateIndex
CREATE INDEX "ClassificationProposal_deviceModelId_idx" ON "ClassificationProposal"("deviceModelId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_reference_key" ON "ServiceRequest"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_idempotencyKey_key" ON "ServiceRequest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ServiceRequest_tenantId_createdAt_idx" ON "ServiceRequest"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "StatusEvent_serviceRequestId_changedAt_idx" ON "StatusEvent"("serviceRequestId", "changedAt");

-- CreateIndex
CREATE INDEX "Attachment_serviceRequestId_idx" ON "Attachment"("serviceRequestId");

-- CreateIndex
CREATE INDEX "DispatchTarget_tenantId_enabled_idx" ON "DispatchTarget"("tenantId", "enabled");

-- CreateIndex
CREATE INDEX "DispatchRecord_serviceRequestId_idx" ON "DispatchRecord"("serviceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderRequest_reference_key" ON "OrderRequest"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "OrderRequest_idempotencyKey_key" ON "OrderRequest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OrderRequest_tenantId_createdAt_idx" ON "OrderRequest"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderRequestId_idx" ON "OrderItem"("orderRequestId");

-- CreateIndex
CREATE INDEX "ExternalCallLog_system_identifierHash_startedAt_idx" ON "ExternalCallLog"("system", "identifierHash", "startedAt");

-- CreateIndex
CREATE INDEX "ExternalCallLog_tenantId_startedAt_idx" ON "ExternalCallLog"("tenantId", "startedAt");
