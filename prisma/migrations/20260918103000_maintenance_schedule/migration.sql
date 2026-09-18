-- Maintenance cycle defaults on models; per-instance schedule + audit events.

ALTER TABLE `DeviceModel` ADD COLUMN `maintenanceCycleMonths` INTEGER NULL;

ALTER TABLE `DeviceInstance` ADD COLUMN `maintenanceCycleMonths` INTEGER NULL,
    ADD COLUMN `maintenanceAnchorAt` DATETIME(3) NULL,
    ADD COLUMN `lastMaintainedAt` DATETIME(3) NULL,
    ADD COLUMN `nextMaintenanceDueAt` DATETIME(3) NULL;

CREATE INDEX `DeviceInstance_tenantId_nextMaintenanceDueAt_idx` ON `DeviceInstance`(`tenantId`, `nextMaintenanceDueAt`);

CREATE TABLE `MaintenanceEvent` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `deviceInstanceId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `performedAt` DATETIME(3) NOT NULL,
    `previousDueAt` DATETIME(3) NULL,
    `nextDueAt` DATETIME(3) NULL,
    `cycleMonths` INTEGER NULL,
    `note` TEXT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `MaintenanceEvent_tenantId_deviceInstanceId_performedAt_idx` ON `MaintenanceEvent`(`tenantId`, `deviceInstanceId`, `performedAt`);
CREATE INDEX `MaintenanceEvent_tenantId_performedAt_idx` ON `MaintenanceEvent`(`tenantId`, `performedAt`);

ALTER TABLE `MaintenanceEvent` ADD CONSTRAINT `MaintenanceEvent_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `MaintenanceEvent` ADD CONSTRAINT `MaintenanceEvent_deviceInstanceId_fkey` FOREIGN KEY (`deviceInstanceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
