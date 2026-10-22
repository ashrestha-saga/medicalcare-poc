-- Phase 6: ModelDocument + AttachmentBlob.storageKey (dual-read with legacy dataUrl).

CREATE TABLE `ModelDocument` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `deviceModelId` VARCHAR(191) NOT NULL,
    `kind` ENUM('ifu', 'service_manual', 'safety_notice', 'work_instruction', 'other') NOT NULL,
    `revisionLabel` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'de',
    `validFrom` DATE NOT NULL,
    `supersededAt` DATE NULL,
    `supersededById` VARCHAR(191) NULL,
    `fieldSafetyActionId` VARCHAR(191) NULL,
    `blobId` VARCHAR(191) NULL,
    `externalUrl` VARCHAR(191) NULL,
    `recordedByName` VARCHAR(191) NOT NULL,
    `recordedByUserId` VARCHAR(191) NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `ModelDocument_deviceModelId_kind_revisionLabel_language_key`(`deviceModelId`, `kind`, `revisionLabel`, `language`),
    INDEX `ModelDocument_deviceModelId_kind_supersededAt_idx`(`deviceModelId`, `kind`, `supersededAt`),
    INDEX `ModelDocument_tenantId_idx`(`tenantId`),
    INDEX `ModelDocument_blobId_idx`(`blobId`),
    INDEX `ModelDocument_fieldSafetyActionId_idx`(`fieldSafetyActionId`),
    INDEX `ModelDocument_recordedByUserId_idx`(`recordedByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ModelDocument` ADD CONSTRAINT `ModelDocument_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ModelDocument` ADD CONSTRAINT `ModelDocument_deviceModelId_fkey` FOREIGN KEY (`deviceModelId`) REFERENCES `DeviceModel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ModelDocument` ADD CONSTRAINT `ModelDocument_supersededById_fkey` FOREIGN KEY (`supersededById`) REFERENCES `ModelDocument`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ModelDocument` ADD CONSTRAINT `ModelDocument_fieldSafetyActionId_fkey` FOREIGN KEY (`fieldSafetyActionId`) REFERENCES `FieldSafetyAction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ModelDocument` ADD CONSTRAINT `ModelDocument_blobId_fkey` FOREIGN KEY (`blobId`) REFERENCES `AttachmentBlob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ModelDocument` ADD CONSTRAINT `ModelDocument_recordedByUserId_fkey` FOREIGN KEY (`recordedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `AttachmentBlob` MODIFY `dataUrl` LONGTEXT NULL;
ALTER TABLE `AttachmentBlob` ADD COLUMN `storageKey` VARCHAR(512) NULL;
CREATE INDEX `AttachmentBlob_storageKey_idx` ON `AttachmentBlob`(`storageKey`);
