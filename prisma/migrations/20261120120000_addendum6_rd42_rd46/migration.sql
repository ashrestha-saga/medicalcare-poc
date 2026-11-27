-- Addendum 6 · RD42–RD46 (E103–E108)

-- RD42 · provisional import duties
ALTER TABLE `DeviceReleaseSnapshot` ADD COLUMN `provisional` BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX `DeviceReleaseSnapshot_deviceInstanceId_provisional_idx` ON `DeviceReleaseSnapshot`(`deviceInstanceId`, `provisional`);

ALTER TABLE `DeviceDuty` ADD COLUMN `provisional` BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX `DeviceDuty_tenantId_provisional_applicable_suspendedAt_idx` ON `DeviceDuty`(`tenantId`, `provisional`, `applicable`, `suspendedAt`);

-- RD43 · tenant classification
ALTER TABLE `DeviceModelClassification` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `DeviceModelClassification` ADD COLUMN `templateId` VARCHAR(191) NULL;
CREATE INDEX `DeviceModelClassification_tenantId_deviceModelId_validTo_idx` ON `DeviceModelClassification`(`tenantId`, `deviceModelId`, `validTo`);

-- Backfill open keys to global:<modelId> (idempotent for already-prefixed rows)
UPDATE `DeviceModelClassification`
SET `openClassificationKey` = CONCAT('global:', `deviceModelId`)
WHERE `validTo` IS NULL
  AND `openClassificationKey` IS NOT NULL
  AND `openClassificationKey` NOT LIKE 'global:%'
  AND `openClassificationKey` NOT LIKE '%:%';

ALTER TABLE `DeviceModelClassification`
  ADD CONSTRAINT `DeviceModelClassification_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RD44 · routine function checks
CREATE TABLE `RefRoutineCheck` (
  `code` VARCHAR(191) NOT NULL,
  `ruleSetId` VARCHAR(191) NOT NULL,
  `scope` ENUM('model', 'product_kind') NOT NULL,
  `deviceModelId` VARCHAR(191) NULL,
  `productKindCode` VARCHAR(191) NULL,
  `label` TEXT NOT NULL,
  `cadence` ENUM('per_use', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'per_batch') NOT NULL,
  `checkpointsJson` JSON NULL,
  `unit` VARCHAR(191) NULL,
  `limitText` VARCHAR(191) NULL,
  `limitSource` ENUM('standard', 'manufacturer', 'applied_part', 'annex2', 'baseline', 'operator') NULL,
  `basisText` TEXT NOT NULL,
  `confidence` ENUM('verified', 'responsible', 'determination', 'derived', 'not_applicable', 'guess') NOT NULL DEFAULT 'determination',
  `determinedBy` VARCHAR(191) NOT NULL,
  `determinedByUserId` VARCHAR(191) NULL,
  `determinedAt` DATE NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (`code`),
  INDEX `RefRoutineCheck_tenantId_scope_active_idx`(`tenantId`, `scope`, `active`),
  INDEX `RefRoutineCheck_deviceModelId_idx`(`deviceModelId`),
  INDEX `RefRoutineCheck_productKindCode_idx`(`productKindCode`),
  CONSTRAINT `RefRoutineCheck_ruleSetId_fkey` FOREIGN KEY (`ruleSetId`) REFERENCES `RefRuleSet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `RefRoutineCheck_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RoutineCheck` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `checkCode` VARCHAR(191) NOT NULL,
  `deviceInstanceId` VARCHAR(191) NOT NULL,
  `performedAt` DATETIME(3) NOT NULL,
  `performedBy` VARCHAR(191) NOT NULL,
  `performedById` VARCHAR(191) NULL,
  `passed` BOOLEAN NULL,
  `measuredValue` VARCHAR(191) NULL,
  `withinLimit` BOOLEAN NULL,
  `findingsJson` JSON NULL,
  `bookEntryId` VARCHAR(191) NULL,
  `serviceRequestId` VARCHAR(191) NULL,
  `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `idempotencyKey` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `RoutineCheck_idempotencyKey_key`(`idempotencyKey`),
  INDEX `RoutineCheck_tenantId_deviceInstanceId_performedAt_idx`(`tenantId`, `deviceInstanceId`, `performedAt`),
  INDEX `RoutineCheck_tenantId_performedAt_idx`(`tenantId`, `performedAt`),
  INDEX `RoutineCheck_checkCode_idx`(`checkCode`),
  CONSTRAINT `RoutineCheck_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `RoutineCheck_checkCode_fkey` FOREIGN KEY (`checkCode`) REFERENCES `RefRoutineCheck`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `RoutineCheck_deviceInstanceId_fkey` FOREIGN KEY (`deviceInstanceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- RD45 · report artefact, acknowledgement, dossier export
ALTER TABLE `InspectionRun` ADD COLUMN `reportBlobId` VARCHAR(191) NULL;
ALTER TABLE `InspectionRun` ADD COLUMN `reportSha256` VARCHAR(191) NULL;
CREATE INDEX `InspectionRun_reportBlobId_idx` ON `InspectionRun`(`reportBlobId`);
ALTER TABLE `InspectionRun`
  ADD CONSTRAINT `InspectionRun_reportBlobId_fkey`
  FOREIGN KEY (`reportBlobId`) REFERENCES `AttachmentBlob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DutyPerformance` ADD COLUMN `acknowledgedBy` VARCHAR(191) NULL;
ALTER TABLE `DutyPerformance` ADD COLUMN `acknowledgedByUserId` VARCHAR(191) NULL;
ALTER TABLE `DutyPerformance` ADD COLUMN `acknowledgedAt` DATETIME(3) NULL;
CREATE INDEX `DutyPerformance_tenantId_acknowledgedAt_idx` ON `DutyPerformance`(`tenantId`, `acknowledgedAt`);
ALTER TABLE `DutyPerformance`
  ADD CONSTRAINT `DutyPerformance_acknowledgedByUserId_fkey`
  FOREIGN KEY (`acknowledgedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ExportLog` ADD COLUMN `kind` VARCHAR(191) NOT NULL DEFAULT 'inventory';
ALTER TABLE `ExportLog` ADD COLUMN `deviceInstanceId` VARCHAR(191) NULL;
CREATE INDEX `ExportLog_tenantId_kind_createdAt_idx` ON `ExportLog`(`tenantId`, `kind`, `createdAt`);
CREATE INDEX `ExportLog_deviceInstanceId_idx` ON `ExportLog`(`deviceInstanceId`);
ALTER TABLE `ExportLog`
  ADD CONSTRAINT `ExportLog_deviceInstanceId_fkey`
  FOREIGN KEY (`deviceInstanceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RD46 · user notifications
CREATE TABLE `UserNotification` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `organisationId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `body` TEXT NULL,
  `targetJson` JSON NOT NULL,
  `dedupKey` VARCHAR(191) NOT NULL,
  `state` VARCHAR(191) NOT NULL DEFAULT 'unread',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `readAt` DATETIME(3) NULL,
  `doneAt` DATETIME(3) NULL,
  `mailedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `UserNotification_userId_dedupKey_key`(`userId`, `dedupKey`),
  INDEX `UserNotification_userId_state_createdAt_idx`(`userId`, `state`, `createdAt`),
  INDEX `UserNotification_tenantId_kind_idx`(`tenantId`, `kind`),
  INDEX `UserNotification_organisationId_kind_idx`(`organisationId`, `kind`),
  CONSTRAINT `UserNotification_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `UserNotification_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `UserNotification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
