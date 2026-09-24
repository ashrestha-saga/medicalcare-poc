-- Assignment spine (FA-710–715): duty link, allocation, transmit lock, executors, performance.

CREATE TABLE `ExecutorOrg` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `ExecutorOrg_tenantId_code_key` ON `ExecutorOrg`(`tenantId`, `code`);
CREATE INDEX `ExecutorOrg_tenantId_idx` ON `ExecutorOrg`(`tenantId`);

ALTER TABLE `ExecutorOrg`
  ADD CONSTRAINT `ExecutorOrg_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `DutyPerformance` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `deviceDutyId` VARCHAR(191) NOT NULL,
    `serviceRequestId` VARCHAR(191) NULL,
    `performedAt` DATE NOT NULL,
    `result` VARCHAR(191) NOT NULL DEFAULT 'passed',
    `note` TEXT NULL,
    `performedBy` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'assignment',
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `DutyPerformance_deviceDutyId_performedAt_idx` ON `DutyPerformance`(`deviceDutyId`, `performedAt`);
CREATE INDEX `DutyPerformance_tenantId_idx` ON `DutyPerformance`(`tenantId`);
CREATE INDEX `DutyPerformance_serviceRequestId_idx` ON `DutyPerformance`(`serviceRequestId`);

ALTER TABLE `DutyPerformance`
  ADD CONSTRAINT `DutyPerformance_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DutyPerformance`
  ADD CONSTRAINT `DutyPerformance_deviceDutyId_fkey`
  FOREIGN KEY (`deviceDutyId`) REFERENCES `DeviceDuty`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ServiceRequest`
  ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'app',
  ADD COLUMN `dutyId` VARCHAR(191) NULL,
  ADD COLUMN `executorOrgId` VARCHAR(191) NULL,
  ADD COLUMN `allocatedAt` DATETIME(3) NULL,
  ADD COLUMN `allocatedBy` VARCHAR(191) NULL,
  ADD COLUMN `transmittedAt` DATETIME(3) NULL;

CREATE INDEX `ServiceRequest_dutyId_idx` ON `ServiceRequest`(`dutyId`);
CREATE INDEX `ServiceRequest_executorOrgId_idx` ON `ServiceRequest`(`executorOrgId`);
CREATE INDEX `ServiceRequest_tenantId_source_state_idx` ON `ServiceRequest`(`tenantId`, `source`, `state`);

ALTER TABLE `ServiceRequest`
  ADD CONSTRAINT `ServiceRequest_dutyId_fkey`
  FOREIGN KEY (`dutyId`) REFERENCES `DeviceDuty`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ServiceRequest`
  ADD CONSTRAINT `ServiceRequest_executorOrgId_fkey`
  FOREIGN KEY (`executorOrgId`) REFERENCES `ExecutorOrg`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DutyPerformance`
  ADD CONSTRAINT `DutyPerformance_serviceRequestId_fkey`
  FOREIGN KEY (`serviceRequestId`) REFERENCES `ServiceRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
