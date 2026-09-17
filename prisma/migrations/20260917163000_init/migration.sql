-- CreateTable
CREATE TABLE `Tenant` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `totpEnabled` BOOLEAN NOT NULL DEFAULT false,
    `totpSecretEnc` TEXT NULL,
    `totpVerifiedAt` DATETIME(3) NULL,
    `totpBackupHashes` TEXT NULL,
    `totpPendingEnc` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `User_tenantId_idx`(`tenantId`),
    INDEX `User_email_idx`(`email`),
    UNIQUE INDEX `User_tenantId_email_key`(`tenantId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TotpChallenge` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TotpChallenge_userId_idx`(`userId`),
    INDEX `TotpChallenge_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TenantOxidConnection` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `shopBaseUrl` VARCHAR(191) NULL,
    `customerNumber` VARCHAR(191) NULL,
    `companyName` VARCHAR(191) NULL,
    `accessToken` TEXT NULL,
    `refreshToken` TEXT NULL,
    `expiresAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'disconnected',
    `lastError` TEXT NULL,
    `connectedAt` DATETIME(3) NULL,
    `connectedByUserId` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TenantOxidConnection_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Site` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `deliveryAddress` TEXT NULL,

    INDEX `Site_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `Site_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Area` (
    `id` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    INDEX `Area_siteId_idx`(`siteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeviceModel` (
    `id` VARCHAR(191) NOT NULL,
    `basicUdiDi` VARCHAR(191) NULL,
    `udiDi` VARCHAR(191) NULL,
    `gtins` TEXT NULL,
    `manufacturer` VARCHAR(191) NULL,
    `manufacturerSrn` VARCHAR(191) NULL,
    `tradeName` VARCHAR(191) NULL,
    `modelName` VARCHAR(191) NULL,
    `riskClass` VARCHAR(191) NULL,
    `emdnCode` VARCHAR(191) NULL,
    `gmdnCode` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL,
    `sourceFetchedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `state` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DeviceModel_basicUdiDi_key`(`basicUdiDi`),
    INDEX `DeviceModel_udiDi_idx`(`udiDi`),
    INDEX `DeviceModel_manufacturer_modelName_idx`(`manufacturer`, `modelName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExternalSourceRecord` (
    `id` VARCHAR(191) NOT NULL,
    `deviceModelId` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `fetchedAt` DATETIME(3) NOT NULL,

    INDEX `ExternalSourceRecord_source_identifier_fetchedAt_idx`(`source`, `identifier`, `fetchedAt`),
    INDEX `ExternalSourceRecord_deviceModelId_idx`(`deviceModelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeviceInstance` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `inventoryNumber` VARCHAR(191) NOT NULL,
    `serialNumber` VARCHAR(191) NULL,
    `modelId` VARCHAR(191) NULL,
    `areaId` VARCHAR(191) NULL,
    `room` VARCHAR(191) NULL,
    `commissionedAt` DATETIME(3) NULL,
    `responsiblePerson` VARCHAR(191) NULL,
    `classificationId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DeviceInstance_classificationId_key`(`classificationId`),
    INDEX `DeviceInstance_tenantId_serialNumber_idx`(`tenantId`, `serialNumber`),
    UNIQUE INDEX `DeviceInstance_tenantId_inventoryNumber_key`(`tenantId`, `inventoryNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CapturedArticle` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `manufacturer` VARCHAR(191) NULL,
    `number` VARCHAR(191) NULL,
    `numberType` VARCHAR(191) NOT NULL,
    `rawIdentifier` VARCHAR(191) NULL,
    `nameplateAttachmentId` VARCHAR(191) NULL,
    `capturedBy` VARCHAR(191) NULL,
    `capturedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `serviceOnly` BOOLEAN NOT NULL DEFAULT true,

    INDEX `CapturedArticle_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Classification` (
    `id` VARCHAR(191) NOT NULL,
    `annex1` BOOLEAN NULL,
    `annex2` BOOLEAN NULL,
    `softwareClass` VARCHAR(191) NULL,
    `radiation` BOOLEAN NULL,
    `confirmedBy` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `proposalId` VARCHAR(191) NULL,
    `overriddenFromProposal` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClassificationRule` (
    `id` VARCHAR(191) NOT NULL,
    `matchType` VARCHAR(191) NOT NULL,
    `matchValue` VARCHAR(191) NOT NULL,
    `annex1` BOOLEAN NULL,
    `annex2` BOOLEAN NULL,
    `softwareClass` VARCHAR(191) NULL,
    `radiation` BOOLEAN NULL,
    `confidence` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `validFrom` DATETIME(3) NULL,
    `validTo` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ClassificationRule_matchType_matchValue_idx`(`matchType`, `matchValue`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClassificationProposal` (
    `id` VARCHAR(191) NOT NULL,
    `deviceModelId` VARCHAR(191) NOT NULL,
    `ruleId` VARCHAR(191) NULL,
    `annex1` BOOLEAN NULL,
    `annex2` BOOLEAN NULL,
    `softwareClass` VARCHAR(191) NULL,
    `radiation` BOOLEAN NULL,
    `confidence` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ClassificationProposal_deviceModelId_idx`(`deviceModelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceRequest` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `subjectType` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `serviceType` VARCHAR(191) NOT NULL,
    `priority` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `raisedBy` VARCHAR(191) NULL,
    `raisedById` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `locationText` TEXT NOT NULL,
    `accessHint` TEXT NULL,
    `contact` VARCHAR(191) NULL,
    `deliveryAddress` TEXT NOT NULL,
    `classification` TEXT NULL,
    `correlationId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `state` VARCHAR(191) NOT NULL DEFAULT 'captured',

    UNIQUE INDEX `ServiceRequest_reference_key`(`reference`),
    UNIQUE INDEX `ServiceRequest_idempotencyKey_key`(`idempotencyKey`),
    INDEX `ServiceRequest_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `ServiceRequest_raisedById_idx`(`raisedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StatusEvent` (
    `id` VARCHAR(191) NOT NULL,
    `serviceRequestId` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `source` VARCHAR(191) NOT NULL,
    `actor` VARCHAR(191) NULL,
    `note` TEXT NULL,

    INDEX `StatusEvent_serviceRequestId_changedAt_idx`(`serviceRequestId`, `changedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attachment` (
    `id` VARCHAR(191) NOT NULL,
    `serviceRequestId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Attachment_serviceRequestId_idx`(`serviceRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttachmentBlob` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `dataUrl` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AttachmentBlob_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DispatchTarget` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `endpoint` TEXT NULL,
    `auth` TEXT NULL,
    `mapping` TEXT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `retryPolicy` TEXT NULL,

    INDEX `DispatchTarget_tenantId_enabled_idx`(`tenantId`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DispatchRecord` (
    `id` VARCHAR(191) NOT NULL,
    `serviceRequestId` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NULL,
    `target` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `success` BOOLEAN NOT NULL DEFAULT false,
    `httpStatus` INTEGER NULL,
    `response` TEXT NULL,
    `error` TEXT NULL,
    `attemptCount` INTEGER NOT NULL DEFAULT 1,
    `correlationId` VARCHAR(191) NULL,

    INDEX `DispatchRecord_serviceRequestId_idx`(`serviceRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderRequest` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `raisedBy` VARCHAR(191) NULL,
    `raisedById` VARCHAR(191) NULL,
    `subjectType` VARCHAR(191) NULL,
    `subjectId` VARCHAR(191) NULL,
    `deliveryAddress` TEXT NOT NULL,
    `note` TEXT NULL,
    `approvalState` VARCHAR(191) NOT NULL DEFAULT 'pending_approval',
    `state` VARCHAR(191) NOT NULL DEFAULT 'captured',
    `correlationId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OrderRequest_reference_key`(`reference`),
    UNIQUE INDEX `OrderRequest_idempotencyKey_key`(`idempotencyKey`),
    INDEX `OrderRequest_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `OrderRequest_raisedById_idx`(`raisedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `orderRequestId` VARCHAR(191) NOT NULL,
    `articleId` VARCHAR(191) NULL,
    `articleNumber` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DOUBLE NULL,

    INDEX `OrderItem_orderRequestId_idx`(`orderRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExternalCallLog` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `system` VARCHAR(191) NOT NULL,
    `operation` VARCHAR(191) NOT NULL,
    `identifierHash` VARCHAR(191) NOT NULL,
    `correlationId` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `durationMs` INTEGER NOT NULL,
    `cacheHit` BOOLEAN NOT NULL DEFAULT false,
    `success` BOOLEAN NOT NULL,
    `httpStatus` INTEGER NULL,
    `error` TEXT NULL,

    INDEX `ExternalCallLog_system_identifierHash_startedAt_idx`(`system`, `identifierHash`, `startedAt`),
    INDEX `ExternalCallLog_tenantId_startedAt_idx`(`tenantId`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TotpChallenge` ADD CONSTRAINT `TotpChallenge_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TenantOxidConnection` ADD CONSTRAINT `TenantOxidConnection_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TenantOxidConnection` ADD CONSTRAINT `TenantOxidConnection_connectedByUserId_fkey` FOREIGN KEY (`connectedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Site` ADD CONSTRAINT `Site_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Area` ADD CONSTRAINT `Area_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExternalSourceRecord` ADD CONSTRAINT `ExternalSourceRecord_deviceModelId_fkey` FOREIGN KEY (`deviceModelId`) REFERENCES `DeviceModel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceInstance` ADD CONSTRAINT `DeviceInstance_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceInstance` ADD CONSTRAINT `DeviceInstance_modelId_fkey` FOREIGN KEY (`modelId`) REFERENCES `DeviceModel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceInstance` ADD CONSTRAINT `DeviceInstance_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `Area`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceInstance` ADD CONSTRAINT `DeviceInstance_classificationId_fkey` FOREIGN KEY (`classificationId`) REFERENCES `Classification`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CapturedArticle` ADD CONSTRAINT `CapturedArticle_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassificationProposal` ADD CONSTRAINT `ClassificationProposal_deviceModelId_fkey` FOREIGN KEY (`deviceModelId`) REFERENCES `DeviceModel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceRequest` ADD CONSTRAINT `ServiceRequest_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceRequest` ADD CONSTRAINT `ServiceRequest_raisedById_fkey` FOREIGN KEY (`raisedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StatusEvent` ADD CONSTRAINT `StatusEvent_serviceRequestId_fkey` FOREIGN KEY (`serviceRequestId`) REFERENCES `ServiceRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_serviceRequestId_fkey` FOREIGN KEY (`serviceRequestId`) REFERENCES `ServiceRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DispatchTarget` ADD CONSTRAINT `DispatchTarget_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DispatchRecord` ADD CONSTRAINT `DispatchRecord_serviceRequestId_fkey` FOREIGN KEY (`serviceRequestId`) REFERENCES `ServiceRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DispatchRecord` ADD CONSTRAINT `DispatchRecord_targetId_fkey` FOREIGN KEY (`targetId`) REFERENCES `DispatchTarget`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderRequest` ADD CONSTRAINT `OrderRequest_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderRequest` ADD CONSTRAINT `OrderRequest_raisedById_fkey` FOREIGN KEY (`raisedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderRequestId_fkey` FOREIGN KEY (`orderRequestId`) REFERENCES `OrderRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExternalCallLog` ADD CONSTRAINT `ExternalCallLog_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

