-- Multi-area work scope for clinic users (Scan / inventory).

CREATE TABLE `UserAreaAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `areaId` VARCHAR(191) NOT NULL,
    `validFrom` DATE NOT NULL,
    `validTo` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `UserAreaAssignment_userId_areaId_key` ON `UserAreaAssignment`(`userId`, `areaId`);
CREATE INDEX `UserAreaAssignment_tenantId_userId_idx` ON `UserAreaAssignment`(`tenantId`, `userId`);
CREATE INDEX `UserAreaAssignment_areaId_idx` ON `UserAreaAssignment`(`areaId`);

ALTER TABLE `UserAreaAssignment` ADD CONSTRAINT `UserAreaAssignment_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `UserAreaAssignment` ADD CONSTRAINT `UserAreaAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `UserAreaAssignment` ADD CONSTRAINT `UserAreaAssignment_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `Area`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from existing homeAreaId
INSERT INTO `UserAreaAssignment` (`id`, `tenantId`, `userId`, `areaId`, `validFrom`, `validTo`, `createdAt`)
SELECT CONCAT('uaa_', u.`id`), u.`tenantId`, u.`id`, u.`homeAreaId`, CURDATE(), NULL, CURRENT_TIMESTAMP(3)
FROM `User` u
WHERE u.`tenantId` IS NOT NULL AND u.`homeAreaId` IS NOT NULL
  AND u.`accountKind` = 'clinic';

ALTER TABLE `UserInvitation` ADD COLUMN `homeAreaId` VARCHAR(191) NULL;
ALTER TABLE `UserInvitation` ADD COLUMN `areaIds` JSON NULL;
