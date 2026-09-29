-- B Wave 2 hygiene (resume after partial apply).

-- AttachmentBlob columns may already exist from failed attempt
SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AttachmentBlob' AND COLUMN_NAME = 'byteSize'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `AttachmentBlob` ADD COLUMN `byteSize` INTEGER NULL, ADD COLUMN `contentType` VARCHAR(191) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Convert annex match arrays from TEXT to JSON when still TEXT
SET @coltype := (
  SELECT DATA_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RefAnnex2Item' AND COLUMN_NAME = 'matchTerms'
);
SET @sql := IF(@coltype = 'json', 'SELECT 1',
  'ALTER TABLE `RefAnnex2Item` MODIFY `matchTerms` JSON NOT NULL, MODIFY `matchExclude` JSON NOT NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @coltype := (
  SELECT DATA_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RefProductKind' AND COLUMN_NAME = 'shows'
);
SET @sql := IF(@coltype = 'json', 'SELECT 1',
  'ALTER TABLE `RefProductKind` MODIFY `shows` JSON NOT NULL, MODIFY `blocks` JSON NOT NULL, MODIFY `presets` JSON NOT NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Site' AND COLUMN_NAME = 'street'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `Site` ADD COLUMN `city` VARCHAR(191) NULL, ADD COLUMN `country` VARCHAR(191) NULL DEFAULT ''DE'', ADD COLUMN `postalCode` VARCHAR(191) NULL, ADD COLUMN `street` VARCHAR(191) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `UserInvitation` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `organisationId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `role` VARCHAR(191) NULL,
    `appRole` ENUM('inspector', 'admin', 'order') NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `acceptedAt` DATETIME(3) NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserInvitation_tokenHash_key`(`tokenHash`),
    INDEX `UserInvitation_tenantId_email_idx`(`tenantId`, `email`),
    INDEX `UserInvitation_organisationId_email_idx`(`organisationId`, `email`),
    INDEX `UserInvitation_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- FKs: ignore if already present
SET @exist := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'UserInvitation' AND CONSTRAINT_NAME = 'UserInvitation_tenantId_fkey'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `UserInvitation` ADD CONSTRAINT `UserInvitation_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'UserInvitation' AND CONSTRAINT_NAME = 'UserInvitation_organisationId_fkey'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `UserInvitation` ADD CONSTRAINT `UserInvitation_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
