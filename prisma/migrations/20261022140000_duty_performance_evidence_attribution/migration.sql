-- PR E / Phase 2: User FK attribution on DutyPerformance + DeviceEvidence (keep frozen name columns).

ALTER TABLE `DutyPerformance` ADD COLUMN `performedByUserId` VARCHAR(191) NULL;
CREATE INDEX `DutyPerformance_performedByUserId_idx` ON `DutyPerformance`(`performedByUserId`);
ALTER TABLE `DutyPerformance` ADD CONSTRAINT `DutyPerformance_performedByUserId_fkey` FOREIGN KEY (`performedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DeviceEvidence` ADD COLUMN `recordedByUserId` VARCHAR(191) NULL;
CREATE INDEX `DeviceEvidence_recordedByUserId_idx` ON `DeviceEvidence`(`recordedByUserId`);
ALTER TABLE `DeviceEvidence` ADD CONSTRAINT `DeviceEvidence_recordedByUserId_fkey` FOREIGN KEY (`recordedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
