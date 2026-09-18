-- Link inventory responsible person to a tenant User (for dropdown + future mail).

ALTER TABLE `DeviceInstance` ADD COLUMN `responsibleUserId` VARCHAR(191) NULL;

CREATE INDEX `DeviceInstance_responsibleUserId_idx` ON `DeviceInstance`(`responsibleUserId`);

ALTER TABLE `DeviceInstance`
  ADD CONSTRAINT `DeviceInstance_responsibleUserId_fkey`
  FOREIGN KEY (`responsibleUserId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
