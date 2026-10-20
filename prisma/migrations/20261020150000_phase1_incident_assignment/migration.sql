-- Phase 1: incident assignment fields for MPSB workflow ownership.

ALTER TABLE `DeviceIncident` ADD COLUMN `assignedUserId` VARCHAR(191) NULL;
ALTER TABLE `DeviceIncident` ADD COLUMN `assignedUserName` VARCHAR(191) NULL;
ALTER TABLE `DeviceIncident` ADD COLUMN `assignedAt` DATETIME(3) NULL;
ALTER TABLE `DeviceIncident` ADD COLUMN `assignmentDueAt` DATE NULL;

CREATE INDEX `DeviceIncident_assignedUserId_idx` ON `DeviceIncident`(`assignedUserId`);
ALTER TABLE `DeviceIncident` ADD CONSTRAINT `DeviceIncident_assignedUserId_fkey` FOREIGN KEY (`assignedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
