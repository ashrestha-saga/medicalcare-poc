-- Nachtrag 3 Bestandsimport RD12–RD17 (additive)

-- AlterTable DeviceInstance
ALTER TABLE `DeviceInstance` ADD COLUMN `importJobId` VARCHAR(191) NULL,
    ADD COLUMN `importHint` VARCHAR(191) NULL;

-- AlterTable UserInvitation
ALTER TABLE `UserInvitation` ADD COLUMN `kind` VARCHAR(191) NOT NULL DEFAULT 'user',
    ADD COLUMN `scopeJson` JSON NULL,
    ADD COLUMN `invitingTenantId` VARCHAR(191) NULL;

-- CreateTable ImportJob
CREATE TABLE `ImportJob` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NULL,
    `template` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileBlobId` VARCHAR(191) NOT NULL,
    `mapping` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'uploaded',
    `stats` JSON NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `actorKind` VARCHAR(191) NOT NULL DEFAULT 'clinic',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `committedAt` DATETIME(3) NULL,

    INDEX `ImportJob_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `ImportJob_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `ImportJob_organisationId_idx`(`organisationId`),
    INDEX `ImportJob_fileBlobId_idx`(`fileBlobId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable ImportRow
CREATE TABLE `ImportRow` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `sheet` VARCHAR(191) NULL,
    `rowNo` INTEGER NOT NULL,
    `rowKey` VARCHAR(191) NOT NULL,
    `raw` JSON NOT NULL,
    `normalized` JSON NULL,
    `quality` VARCHAR(191) NULL,
    `modelMatch` VARCHAR(191) NULL,
    `modelId` VARCHAR(191) NULL,
    `outcome` VARCHAR(191) NULL,
    `deviceInstanceId` VARCHAR(191) NULL,
    `clarificationIds` JSON NULL,
    `note` TEXT NULL,

    INDEX `ImportRow_tenantId_jobId_quality_idx`(`tenantId`, `jobId`, `quality`),
    INDEX `ImportRow_deviceInstanceId_idx`(`deviceInstanceId`),
    INDEX `ImportRow_modelId_idx`(`modelId`),
    UNIQUE INDEX `ImportRow_jobId_rowKey_key`(`jobId`, `rowKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable RefImportDictionary
CREATE TABLE `RefImportDictionary` (
    `id` VARCHAR(191) NOT NULL,
    `template` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `content` JSON NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RefImportDictionary_template_active_idx`(`template`, `active`),
    UNIQUE INDEX `RefImportDictionary_template_version_key`(`template`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Indexes / FKs
CREATE INDEX `DeviceInstance_importJobId_idx` ON `DeviceInstance`(`importJobId`);
CREATE INDEX `UserInvitation_kind_invitingTenantId_idx` ON `UserInvitation`(`kind`, `invitingTenantId`);

ALTER TABLE `ImportJob` ADD CONSTRAINT `ImportJob_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ImportJob` ADD CONSTRAINT `ImportJob_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ImportJob` ADD CONSTRAINT `ImportJob_fileBlobId_fkey` FOREIGN KEY (`fileBlobId`) REFERENCES `AttachmentBlob`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ImportRow` ADD CONSTRAINT `ImportRow_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ImportRow` ADD CONSTRAINT `ImportRow_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `ImportJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ImportRow` ADD CONSTRAINT `ImportRow_deviceInstanceId_fkey` FOREIGN KEY (`deviceInstanceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DeviceInstance` ADD CONSTRAINT `DeviceInstance_importJobId_fkey` FOREIGN KEY (`importJobId`) REFERENCES `ImportJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
