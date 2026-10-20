-- AlterTable
ALTER TABLE `Site` ADD COLUMN `stateCode` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `RefInspectionType` ADD COLUMN `addressee` ENUM('operator', 'employer', 'both') NOT NULL DEFAULT 'operator',
    ADD COLUMN `authorityKind` ENUM('health_office', 'device_authority', 'occupational_safety', 'metrology', 'medical_board', 'other') NULL;

-- AlterTable
ALTER TABLE `DeviceDuty` MODIFY `dutyKey` ENUM('wartung', 'stk', 'mtk', 'abnahme', 'konstanz', 'sv', 'aerztl', 'nuklear', 'itsec', 'install', 'aufbereitung', 'kontrolle', 'validierung', 'validierung_verweis', 'einmalprodukt', 'zubehoer', 'vernetzung', 'implantat', 'dguv') NOT NULL;

-- CreateTable
CREATE TABLE `DeviceBookEntry` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `deviceInstanceId` VARCHAR(191) NOT NULL,
    `kind` ENUM('malfunction', 'operating_error', 'note') NOT NULL,
    `occurredAt` DATE NOT NULL,
    `description` TEXT NOT NULL,
    `consequence` TEXT NULL,
    `repeatCount` INTEGER NULL,
    `incidentId` VARCHAR(191) NULL,
    `correctsEntryId` VARCHAR(191) NULL,
    `recordedBy` VARCHAR(191) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DeviceBookEntry_tenantId_deviceInstanceId_occurredAt_idx`(`tenantId`, `deviceInstanceId`, `occurredAt`),
    INDEX `DeviceBookEntry_tenantId_kind_idx`(`tenantId`, `kind`),
    INDEX `DeviceBookEntry_incidentId_idx`(`incidentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeviceIncident` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `deviceInstanceId` VARCHAR(191) NULL,
    `deviceModelId` VARCHAR(191) NULL,
    `occurredAt` DATE NOT NULL,
    `noticedAt` DATE NOT NULL,
    `description` TEXT NOT NULL,
    `harmDescription` TEXT NULL,
    `suspectedSerious` BOOLEAN NULL,
    `assessedBy` VARCHAR(191) NULL,
    `assessedAt` DATE NULL,
    `assessmentNote` TEXT NULL,
    `reportedAt` DATE NULL,
    `reportReference` VARCHAR(191) NULL,
    `reportedTo` VARCHAR(191) NULL,
    `manufacturerNotifiedAt` DATE NULL,
    `measureTaken` TEXT NULL,
    `closedAt` DATE NULL,
    `closedBy` VARCHAR(191) NULL,
    `recordedBy` VARCHAR(191) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DeviceIncident_tenantId_occurredAt_idx`(`tenantId`, `occurredAt`),
    INDEX `DeviceIncident_tenantId_suspectedSerious_reportedAt_idx`(`tenantId`, `suspectedSerious`, `reportedAt`),
    INDEX `DeviceIncident_deviceInstanceId_idx`(`deviceInstanceId`),
    INDEX `DeviceIncident_deviceModelId_idx`(`deviceModelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FieldSafetyAction` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `manufacturer` VARCHAR(191) NOT NULL,
    `title` TEXT NOT NULL,
    `requiredAction` TEXT NOT NULL,
    `issuedAt` DATE NOT NULL,
    `receivedAt` DATE NOT NULL,
    `dueAt` DATE NULL,
    `affectedScope` TEXT NOT NULL,
    `documentRef` VARCHAR(191) NULL,
    `closedAt` DATE NULL,
    `recordedBy` VARCHAR(191) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FieldSafetyAction_tenantId_dueAt_idx`(`tenantId`, `dueAt`),
    INDEX `FieldSafetyAction_tenantId_closedAt_idx`(`tenantId`, `closedAt`),
    UNIQUE INDEX `FieldSafetyAction_tenantId_reference_key`(`tenantId`, `reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FieldSafetyDeviceAction` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `fieldSafetyActionId` VARCHAR(191) NOT NULL,
    `deviceInstanceId` VARCHAR(191) NOT NULL,
    `affected` BOOLEAN NULL,
    `actionTakenAt` DATE NULL,
    `actionNote` TEXT NULL,
    `recordedBy` VARCHAR(191) NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FieldSafetyDeviceAction_tenantId_affected_actionTakenAt_idx`(`tenantId`, `affected`, `actionTakenAt`),
    INDEX `FieldSafetyDeviceAction_deviceInstanceId_idx`(`deviceInstanceId`),
    UNIQUE INDEX `FieldSafetyDeviceAction_fieldSafetyActionId_deviceInstanceId_key`(`fieldSafetyActionId`, `deviceInstanceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefReprocessingCheck` (
    `code` VARCHAR(191) NOT NULL,
    `ruleSetId` VARCHAR(191) NOT NULL,
    `scope` ENUM('equipment', 'water', 'chemistry', 'sterile_storage') NOT NULL,
    `equipmentTypeCode` VARCHAR(191) NULL,
    `label` TEXT NOT NULL,
    `cadence` ENUM('per_use', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'per_batch') NOT NULL,
    `legalBasis` TEXT NULL,
    `unit` VARCHAR(191) NULL,
    `limitText` VARCHAR(191) NULL,
    `limitSource` ENUM('standard', 'manufacturer', 'applied_part', 'annex2', 'baseline', 'operator') NULL,
    `confidence` ENUM('verified', 'responsible', 'determination', 'derived', 'not_applicable', 'guess') NOT NULL DEFAULT 'determination',
    `note` TEXT NULL,

    INDEX `RefReprocessingCheck_scope_equipmentTypeCode_idx`(`scope`, `equipmentTypeCode`),
    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReprocessingCheck` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `checkCode` VARCHAR(191) NOT NULL,
    `equipmentDeviceId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `batchId` VARCHAR(191) NULL,
    `performedAt` DATE NOT NULL,
    `performedBy` VARCHAR(191) NOT NULL,
    `passed` BOOLEAN NULL,
    `measuredValue` VARCHAR(191) NULL,
    `withinLimit` BOOLEAN NULL,
    `note` TEXT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReprocessingCheck_tenantId_checkCode_performedAt_idx`(`tenantId`, `checkCode`, `performedAt`),
    INDEX `ReprocessingCheck_tenantId_equipmentDeviceId_performedAt_idx`(`tenantId`, `equipmentDeviceId`, `performedAt`),
    INDEX `ReprocessingCheck_tenantId_siteId_performedAt_idx`(`tenantId`, `siteId`, `performedAt`),
    INDEX `ReprocessingCheck_batchId_idx`(`batchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReprocessingBatch` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `equipmentDeviceId` VARCHAR(191) NOT NULL,
    `batchNumber` VARCHAR(191) NOT NULL,
    `programme` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `finishedAt` DATETIME(3) NULL,
    `loadPattern` VARCHAR(191) NULL,
    `processRecordRef` VARCHAR(191) NULL,
    `releaseResult` ENUM('released', 'released_with_conditions', 'rejected') NULL,
    `releasedBy` VARCHAR(191) NULL,
    `releasedAt` DATETIME(3) NULL,
    `releaseNote` TEXT NULL,
    `recordedBy` VARCHAR(191) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReprocessingBatch_tenantId_startedAt_idx`(`tenantId`, `startedAt`),
    INDEX `ReprocessingBatch_tenantId_releaseResult_idx`(`tenantId`, `releaseResult`),
    UNIQUE INDEX `ReprocessingBatch_tenantId_equipmentDeviceId_batchNumber_key`(`tenantId`, `equipmentDeviceId`, `batchNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReprocessingBatchItem` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `deviceInstanceId` VARCHAR(191) NULL,
    `label` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,

    INDEX `ReprocessingBatchItem_tenantId_batchId_idx`(`tenantId`, `batchId`),
    INDEX `ReprocessingBatchItem_deviceInstanceId_idx`(`deviceInstanceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConstancyCadence` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `deviceInstanceId` VARCHAR(191) NOT NULL,
    `constancyObjectCode` VARCHAR(191) NOT NULL,
    `intervalValue` INTEGER NOT NULL,
    `intervalUnit` ENUM('months', 'years') NOT NULL,
    `basisText` TEXT NOT NULL,
    `determinedBy` VARCHAR(191) NOT NULL,
    `determinedAt` DATE NOT NULL,
    `validFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validTo` DATETIME(3) NULL,
    `openCadenceKey` VARCHAR(191) NULL,

    UNIQUE INDEX `ConstancyCadence_openCadenceKey_key`(`openCadenceKey`),
    INDEX `ConstancyCadence_tenantId_deviceInstanceId_validTo_idx`(`tenantId`, `deviceInstanceId`, `validTo`),
    INDEX `ConstancyCadence_constancyObjectCode_idx`(`constancyObjectCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefDashboardTile` (
    `key` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `question` TEXT NOT NULL,
    `zone` ENUM('decides', 'worklist', 'watch') NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `dutyKey` ENUM('wartung', 'stk', 'mtk', 'abnahme', 'konstanz', 'sv', 'aerztl', 'nuklear', 'itsec', 'install', 'aufbereitung', 'kontrolle', 'validierung', 'validierung_verweis', 'einmalprodukt', 'zubehoer', 'vernetzung', 'implantat', 'dguv') NULL,
    `requiredPermission` VARCHAR(191) NULL,
    `partnerOnly` BOOLEAN NOT NULL DEFAULT false,
    `note` TEXT NULL,

    INDEX `RefDashboardTile_zone_sortOrder_idx`(`zone`, `sortOrder`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DashboardTileGrant` (
    `id` VARCHAR(191) NOT NULL,
    `role` ENUM('superadmin', 'device_admin', 'security_officer', 'user') NOT NULL,
    `tileKey` VARCHAR(191) NOT NULL,

    INDEX `DashboardTileGrant_role_idx`(`role`),
    UNIQUE INDEX `DashboardTileGrant_role_tileKey_key`(`role`, `tileKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserDashboardTile` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tileKey` VARCHAR(191) NOT NULL,
    `assignedBy` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserDashboardTile_tenantId_userId_idx`(`tenantId`, `userId`),
    UNIQUE INDEX `UserDashboardTile_userId_tileKey_key`(`userId`, `tileKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthorityInspection` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NULL,
    `authorityKind` ENUM('health_office', 'device_authority', 'occupational_safety', 'metrology', 'medical_board', 'other') NOT NULL,
    `authorityName` VARCHAR(191) NOT NULL,
    `legalBasis` TEXT NULL,
    `announcedAt` DATE NULL,
    `visitedAt` DATE NOT NULL,
    `protocolReceivedAt` DATE NULL,
    `protocolRef` VARCHAR(191) NULL,
    `feeEur` DOUBLE NULL,
    `checklistCode` VARCHAR(191) NULL,
    `disclosureSessionId` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `closedAt` DATE NULL,
    `recordedBy` VARCHAR(191) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AuthorityInspection_disclosureSessionId_key`(`disclosureSessionId`),
    INDEX `AuthorityInspection_tenantId_visitedAt_idx`(`tenantId`, `visitedAt`),
    INDEX `AuthorityInspection_tenantId_authorityKind_idx`(`tenantId`, `authorityKind`),
    INDEX `AuthorityInspection_siteId_idx`(`siteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthorityFinding` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `inspectionId` VARCHAR(191) NOT NULL,
    `itemNo` VARCHAR(191) NULL,
    `description` TEXT NOT NULL,
    `legalBasis` TEXT NULL,
    `dueAt` DATE NULL,
    `status` ENUM('open', 'remediated', 'proven', 'disputed', 'closed') NOT NULL DEFAULT 'open',
    `deviceInstanceId` VARCHAR(191) NULL,
    `remediationNote` TEXT NULL,
    `remediatedAt` DATE NULL,
    `evidenceBlobId` VARCHAR(191) NULL,
    `provenAt` DATE NULL,
    `recordedBy` VARCHAR(191) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuthorityFinding_tenantId_status_dueAt_idx`(`tenantId`, `status`, `dueAt`),
    INDEX `AuthorityFinding_inspectionId_idx`(`inspectionId`),
    INDEX `AuthorityFinding_deviceInstanceId_idx`(`deviceInstanceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DisclosureSession` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `openedByUserId` VARCHAR(191) NULL,
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `closedAt` DATETIME(3) NULL,
    `audience` VARCHAR(191) NOT NULL,
    `purpose` TEXT NULL,
    `scope` TEXT NOT NULL,

    INDEX `DisclosureSession_tenantId_openedAt_idx`(`tenantId`, `openedAt`),
    INDEX `DisclosureSession_tenantId_expiresAt_idx`(`tenantId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefInspectionTypeOverlap` (
    `id` VARCHAR(191) NOT NULL,
    `inspectionTypeCode` VARCHAR(191) NOT NULL,
    `satisfiedByCode` VARCHAR(191) NOT NULL,
    `conditionText` TEXT NOT NULL,
    `legalNote` TEXT NULL,

    UNIQUE INDEX `RefInspectionTypeOverlap_inspectionTypeCode_satisfiedByCode_key`(`inspectionTypeCode`, `satisfiedByCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DutyOverlapDecision` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `deviceInstanceId` VARCHAR(191) NOT NULL,
    `coveredDutyKey` ENUM('wartung', 'stk', 'mtk', 'abnahme', 'konstanz', 'sv', 'aerztl', 'nuklear', 'itsec', 'install', 'aufbereitung', 'kontrolle', 'validierung', 'validierung_verweis', 'einmalprodukt', 'zubehoer', 'vernetzung', 'implantat', 'dguv') NOT NULL,
    `satisfiedByDutyKey` ENUM('wartung', 'stk', 'mtk', 'abnahme', 'konstanz', 'sv', 'aerztl', 'nuklear', 'itsec', 'install', 'aufbereitung', 'kontrolle', 'validierung', 'validierung_verweis', 'einmalprodukt', 'zubehoer', 'vernetzung', 'implantat', 'dguv') NOT NULL,
    `reasonText` TEXT NOT NULL,
    `decidedBy` VARCHAR(191) NOT NULL,
    `decidedAt` DATE NOT NULL,
    `validFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validTo` DATETIME(3) NULL,
    `openDecisionKey` VARCHAR(191) NULL,

    UNIQUE INDEX `DutyOverlapDecision_openDecisionKey_key`(`openDecisionKey`),
    INDEX `DutyOverlapDecision_tenantId_deviceInstanceId_validTo_idx`(`tenantId`, `deviceInstanceId`, `validTo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefAuthorityChecklist` (
    `code` VARCHAR(191) NOT NULL,
    `authorityKind` ENUM('health_office', 'device_authority', 'occupational_safety', 'metrology', 'medical_board', 'other') NOT NULL,
    `stateCode` VARCHAR(191) NULL,
    `label` VARCHAR(191) NOT NULL,
    `sourceRef` TEXT NOT NULL,
    `sourceDate` DATE NULL,

    INDEX `RefAuthorityChecklist_stateCode_idx`(`stateCode`),
    UNIQUE INDEX `RefAuthorityChecklist_authorityKind_stateCode_key`(`authorityKind`, `stateCode`),
    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefAuthorityChecklistItem` (
    `id` VARCHAR(191) NOT NULL,
    `checklistCode` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `label` TEXT NOT NULL,
    `legalBasis` TEXT NULL,
    `mapsToSection` VARCHAR(191) NULL,
    `covered` BOOLEAN NOT NULL DEFAULT true,
    `note` TEXT NULL,

    INDEX `RefAuthorityChecklistItem_checklistCode_idx`(`checklistCode`),
    UNIQUE INDEX `RefAuthorityChecklistItem_checklistCode_position_key`(`checklistCode`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DeviceBookEntry` ADD CONSTRAINT `DeviceBookEntry_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceBookEntry` ADD CONSTRAINT `DeviceBookEntry_deviceInstanceId_fkey` FOREIGN KEY (`deviceInstanceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceBookEntry` ADD CONSTRAINT `DeviceBookEntry_incidentId_fkey` FOREIGN KEY (`incidentId`) REFERENCES `DeviceIncident`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceBookEntry` ADD CONSTRAINT `DeviceBookEntry_correctsEntryId_fkey` FOREIGN KEY (`correctsEntryId`) REFERENCES `DeviceBookEntry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceIncident` ADD CONSTRAINT `DeviceIncident_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceIncident` ADD CONSTRAINT `DeviceIncident_deviceInstanceId_fkey` FOREIGN KEY (`deviceInstanceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceIncident` ADD CONSTRAINT `DeviceIncident_deviceModelId_fkey` FOREIGN KEY (`deviceModelId`) REFERENCES `DeviceModel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FieldSafetyAction` ADD CONSTRAINT `FieldSafetyAction_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FieldSafetyDeviceAction` ADD CONSTRAINT `FieldSafetyDeviceAction_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FieldSafetyDeviceAction` ADD CONSTRAINT `FieldSafetyDeviceAction_fieldSafetyActionId_fkey` FOREIGN KEY (`fieldSafetyActionId`) REFERENCES `FieldSafetyAction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FieldSafetyDeviceAction` ADD CONSTRAINT `FieldSafetyDeviceAction_deviceInstanceId_fkey` FOREIGN KEY (`deviceInstanceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefReprocessingCheck` ADD CONSTRAINT `RefReprocessingCheck_ruleSetId_fkey` FOREIGN KEY (`ruleSetId`) REFERENCES `RefRuleSet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefReprocessingCheck` ADD CONSTRAINT `RefReprocessingCheck_equipmentTypeCode_fkey` FOREIGN KEY (`equipmentTypeCode`) REFERENCES `RefReprocessingEquipmentType`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReprocessingCheck` ADD CONSTRAINT `ReprocessingCheck_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReprocessingCheck` ADD CONSTRAINT `ReprocessingCheck_checkCode_fkey` FOREIGN KEY (`checkCode`) REFERENCES `RefReprocessingCheck`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReprocessingCheck` ADD CONSTRAINT `ReprocessingCheck_equipmentDeviceId_fkey` FOREIGN KEY (`equipmentDeviceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReprocessingCheck` ADD CONSTRAINT `ReprocessingCheck_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReprocessingCheck` ADD CONSTRAINT `ReprocessingCheck_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `ReprocessingBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReprocessingBatch` ADD CONSTRAINT `ReprocessingBatch_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReprocessingBatch` ADD CONSTRAINT `ReprocessingBatch_equipmentDeviceId_fkey` FOREIGN KEY (`equipmentDeviceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReprocessingBatchItem` ADD CONSTRAINT `ReprocessingBatchItem_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReprocessingBatchItem` ADD CONSTRAINT `ReprocessingBatchItem_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `ReprocessingBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReprocessingBatchItem` ADD CONSTRAINT `ReprocessingBatchItem_deviceInstanceId_fkey` FOREIGN KEY (`deviceInstanceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConstancyCadence` ADD CONSTRAINT `ConstancyCadence_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConstancyCadence` ADD CONSTRAINT `ConstancyCadence_deviceInstanceId_fkey` FOREIGN KEY (`deviceInstanceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConstancyCadence` ADD CONSTRAINT `ConstancyCadence_constancyObjectCode_fkey` FOREIGN KEY (`constancyObjectCode`) REFERENCES `RefConstancyObject`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DashboardTileGrant` ADD CONSTRAINT `DashboardTileGrant_tileKey_fkey` FOREIGN KEY (`tileKey`) REFERENCES `RefDashboardTile`(`key`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserDashboardTile` ADD CONSTRAINT `UserDashboardTile_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserDashboardTile` ADD CONSTRAINT `UserDashboardTile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserDashboardTile` ADD CONSTRAINT `UserDashboardTile_tileKey_fkey` FOREIGN KEY (`tileKey`) REFERENCES `RefDashboardTile`(`key`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthorityInspection` ADD CONSTRAINT `AuthorityInspection_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthorityInspection` ADD CONSTRAINT `AuthorityInspection_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthorityInspection` ADD CONSTRAINT `AuthorityInspection_checklistCode_fkey` FOREIGN KEY (`checklistCode`) REFERENCES `RefAuthorityChecklist`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthorityInspection` ADD CONSTRAINT `AuthorityInspection_disclosureSessionId_fkey` FOREIGN KEY (`disclosureSessionId`) REFERENCES `DisclosureSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthorityFinding` ADD CONSTRAINT `AuthorityFinding_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthorityFinding` ADD CONSTRAINT `AuthorityFinding_inspectionId_fkey` FOREIGN KEY (`inspectionId`) REFERENCES `AuthorityInspection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthorityFinding` ADD CONSTRAINT `AuthorityFinding_deviceInstanceId_fkey` FOREIGN KEY (`deviceInstanceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthorityFinding` ADD CONSTRAINT `AuthorityFinding_evidenceBlobId_fkey` FOREIGN KEY (`evidenceBlobId`) REFERENCES `AttachmentBlob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DisclosureSession` ADD CONSTRAINT `DisclosureSession_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DisclosureSession` ADD CONSTRAINT `DisclosureSession_openedByUserId_fkey` FOREIGN KEY (`openedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefInspectionTypeOverlap` ADD CONSTRAINT `RefInspectionTypeOverlap_inspectionTypeCode_fkey` FOREIGN KEY (`inspectionTypeCode`) REFERENCES `RefInspectionType`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefInspectionTypeOverlap` ADD CONSTRAINT `RefInspectionTypeOverlap_satisfiedByCode_fkey` FOREIGN KEY (`satisfiedByCode`) REFERENCES `RefInspectionType`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DutyOverlapDecision` ADD CONSTRAINT `DutyOverlapDecision_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DutyOverlapDecision` ADD CONSTRAINT `DutyOverlapDecision_deviceInstanceId_fkey` FOREIGN KEY (`deviceInstanceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefAuthorityChecklistItem` ADD CONSTRAINT `RefAuthorityChecklistItem_checklistCode_fkey` FOREIGN KEY (`checklistCode`) REFERENCES `RefAuthorityChecklist`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;

