-- AlterTable
ALTER TABLE `DeviceDuty` ADD COLUMN `category` ENUM('inspection', 'operating') NOT NULL DEFAULT 'inspection',
    ADD COLUMN `referenceDeviceId` VARCHAR(191) NULL,
    ADD COLUMN `requiresBaseline` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `setsBaseline` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `deadlineAnchor` ENUM('exact_day', 'month_end', 'year_end', 'event', 'interval', 'process', 'permanent', 'reference', 'none') NOT NULL,
    MODIFY `confidence` ENUM('verified', 'responsible', 'determination', 'derived', 'not_applicable', 'guess') NOT NULL;

-- AlterTable
ALTER TABLE `DeviceInstance` ADD COLUMN `releaseLevel` INTEGER NULL;

-- AlterTable
ALTER TABLE `DeviceModelClassification` ADD COLUMN `characteristics` LONGTEXT NULL,
    ADD COLUMN `decisions` LONGTEXT NULL,
    ADD COLUMN `deferredFields` TEXT NULL,
    ADD COLUMN `fieldStates` LONGTEXT NULL,
    ADD COLUMN `productKindCode` VARCHAR(191) NULL,
    MODIFY `confidence` ENUM('verified', 'responsible', 'determination', 'derived', 'not_applicable', 'guess') NOT NULL DEFAULT 'derived';

-- AlterTable
ALTER TABLE `RefAnnex2Item` ADD COLUMN `confidence` ENUM('verified', 'responsible', 'determination', 'derived', 'not_applicable', 'guess') NOT NULL DEFAULT 'derived',
    ADD COLUMN `sourceRef` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `RefInspectionType` ADD COLUMN `category` ENUM('inspection', 'operating') NOT NULL DEFAULT 'inspection',
    ADD COLUMN `confidence` ENUM('verified', 'responsible', 'determination', 'derived', 'not_applicable', 'guess') NOT NULL DEFAULT 'derived',
    ADD COLUMN `sourceRef` VARCHAR(191) NULL,
    MODIFY `deadlineAnchor` ENUM('exact_day', 'month_end', 'year_end', 'event', 'interval', 'process', 'permanent', 'reference', 'none') NOT NULL;

-- AlterTable
ALTER TABLE `RefRadiationApplication` ADD COLUMN `expertInspectionApplies` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `qualityGuideline` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `RefReprocessingClass` ADD COLUMN `evidence` TEXT NULL,
    ADD COLUMN `requiresValidatedProcess` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `RefCommissioningPrerequisite` (
    `id` VARCHAR(191) NOT NULL,
    `ruleSetId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `legalBasis` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `mandatory` BOOLEAN NOT NULL DEFAULT true,
    `evidenceKind` ENUM('confirmation', 'document', 'third_party') NOT NULL DEFAULT 'confirmation',
    `appliesWhen` TEXT NOT NULL,
    `releaseLevel` INTEGER NOT NULL DEFAULT 1,

    INDEX `RefCommissioningPrerequisite_ruleSetId_idx`(`ruleSetId`),
    UNIQUE INDEX `RefCommissioningPrerequisite_ruleSetId_code_key`(`ruleSetId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeviceClarification` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `deviceInstanceId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `field` VARCHAR(191) NULL,
    `prerequisiteCode` VARCHAR(191) NULL,
    `label` VARCHAR(191) NOT NULL,
    `deferredBy` VARCHAR(191) NOT NULL,
    `deferredAt` DATETIME(3) NOT NULL,
    `resolvedBy` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `resolutionNote` TEXT NULL,

    INDEX `DeviceClarification_tenantId_deviceInstanceId_idx`(`tenantId`, `deviceInstanceId`),
    INDEX `DeviceClarification_tenantId_resolvedAt_idx`(`tenantId`, `resolvedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeviceEvidence` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `deviceInstanceId` VARCHAR(191) NOT NULL,
    `prerequisiteCode` VARCHAR(191) NOT NULL,
    `evidenceKind` ENUM('confirmation', 'document', 'third_party') NOT NULL,
    `attachmentBlobId` VARCHAR(191) NULL,
    `externalRecordRef` VARCHAR(191) NULL,
    `issuedBy` VARCHAR(191) NULL,
    `issuedAt` DATETIME(3) NULL,
    `validUntil` DATETIME(3) NULL,
    `recordedBy` VARCHAR(191) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DeviceEvidence_tenantId_validUntil_idx`(`tenantId`, `validUntil`),
    INDEX `DeviceEvidence_attachmentBlobId_idx`(`attachmentBlobId`),
    UNIQUE INDEX `DeviceEvidence_deviceInstanceId_prerequisiteCode_key`(`deviceInstanceId`, `prerequisiteCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReprocessingOnDevice` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `profileDeviceId` VARCHAR(191) NOT NULL,
    `equipmentDeviceId` VARCHAR(191) NOT NULL,
    `recordedBy` VARCHAR(191) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReprocessingOnDevice_tenantId_equipmentDeviceId_idx`(`tenantId`, `equipmentDeviceId`),
    UNIQUE INDEX `ReprocessingOnDevice_profileDeviceId_equipmentDeviceId_key`(`profileDeviceId`, `equipmentDeviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `DeviceDuty_referenceDeviceId_idx` ON `DeviceDuty`(`referenceDeviceId`);

-- AddForeignKey
ALTER TABLE `RefCommissioningPrerequisite` ADD CONSTRAINT `RefCommissioningPrerequisite_ruleSetId_fkey` FOREIGN KEY (`ruleSetId`) REFERENCES `RefRuleSet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceDuty` ADD CONSTRAINT `DeviceDuty_referenceDeviceId_fkey` FOREIGN KEY (`referenceDeviceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceClarification` ADD CONSTRAINT `DeviceClarification_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceClarification` ADD CONSTRAINT `DeviceClarification_deviceInstanceId_fkey` FOREIGN KEY (`deviceInstanceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceEvidence` ADD CONSTRAINT `DeviceEvidence_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceEvidence` ADD CONSTRAINT `DeviceEvidence_deviceInstanceId_fkey` FOREIGN KEY (`deviceInstanceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceEvidence` ADD CONSTRAINT `DeviceEvidence_attachmentBlobId_fkey` FOREIGN KEY (`attachmentBlobId`) REFERENCES `AttachmentBlob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReprocessingOnDevice` ADD CONSTRAINT `ReprocessingOnDevice_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReprocessingOnDevice` ADD CONSTRAINT `ReprocessingOnDevice_profileDeviceId_fkey` FOREIGN KEY (`profileDeviceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReprocessingOnDevice` ADD CONSTRAINT `ReprocessingOnDevice_equipmentDeviceId_fkey` FOREIGN KEY (`equipmentDeviceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

