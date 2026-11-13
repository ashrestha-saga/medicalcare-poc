-- Repairs package increment 1: RD0 + RD1–RD6 (+ Tenant.featureFlags)

ALTER TABLE `Tenant` ADD COLUMN `featureFlags` JSON NULL;

-- Enums via MySQL ENUM columns on ALTER / CREATE

ALTER TABLE `ServiceVisit`
    ADD COLUMN `date` DATE NULL,
    ADD COLUMN `sequence` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `secondVisitReason` TEXT NULL,
    ADD COLUMN `startRecordedLate` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `setupMinutes` INTEGER NULL,
    ADD COLUMN `idempotencyKey` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `ServiceVisit_idempotencyKey_key` ON `ServiceVisit`(`idempotencyKey`);
CREATE UNIQUE INDEX `ServiceVisit_tenantId_siteId_technicianUserId_date_sequence_key` ON `ServiceVisit`(`tenantId`, `siteId`, `technicianUserId`, `date`, `sequence`);

ALTER TABLE `DeviceInstance`
    ADD COLUMN `operationalState` ENUM('in_service', 'locked', 'under_repair', 'replaced', 'loaner') NOT NULL DEFAULT 'in_service',
    ADD COLUMN `lockSource` ENUM('inspection', 'mpsb', 'user', 'recall') NULL,
    ADD COLUMN `lockClearedAt` DATETIME(3) NULL,
    ADD COLUMN `lockClearedBy` VARCHAR(191) NULL,
    ADD COLUMN `lockClearedNote` TEXT NULL,
    ADD COLUMN `replacedById` VARCHAR(191) NULL,
    ADD COLUMN `loanerLender` VARCHAR(191) NULL;

CREATE INDEX `DeviceInstance_tenantId_operationalState_idx` ON `DeviceInstance`(`tenantId`, `operationalState`);
ALTER TABLE `DeviceInstance` ADD CONSTRAINT `DeviceInstance_replacedById_fkey` FOREIGN KEY (`replacedById`) REFERENCES `DeviceInstance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DeviceBookEntry`
    ADD COLUMN `consequenceCode` ENUM('out_of_service', 'restricted', 'usable') NULL;

ALTER TABLE `ServiceRequest`
    ADD COLUMN `faultDescription` TEXT NULL,
    ADD COLUMN `faultSince` DATE NULL,
    ADD COLUMN `faultConsequence` ENUM('out_of_service', 'restricted', 'usable') NULL,
    ADD COLUMN `faultReportedBy` VARCHAR(191) NULL,
    ADD COLUMN `bookEntryId` VARCHAR(191) NULL,
    ADD COLUMN `replacementInstanceId` VARCHAR(191) NULL,
    ADD COLUMN `proposalState` ENUM('none', 'proposed', 'confirmed', 'discarded') NOT NULL DEFAULT 'none',
    ADD COLUMN `mandatory` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `ServiceRequest_tenantId_serviceType_state_idx` ON `ServiceRequest`(`tenantId`, `serviceType`, `state`);
CREATE INDEX `ServiceRequest_bookEntryId_idx` ON `ServiceRequest`(`bookEntryId`);
ALTER TABLE `ServiceRequest` ADD CONSTRAINT `ServiceRequest_bookEntryId_fkey` FOREIGN KEY (`bookEntryId`) REFERENCES `DeviceBookEntry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ServiceRequest` ADD CONSTRAINT `ServiceRequest_replacementInstanceId_fkey` FOREIGN KEY (`replacementInstanceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `MaintenanceEvent`
    ADD COLUMN `serviceRequestId` VARCHAR(191) NULL,
    ADD COLUMN `inspectionRunId` VARCHAR(191) NULL,
    ADD COLUMN `performedBy` VARCHAR(191) NULL,
    ADD COLUMN `performedByOrgId` VARCHAR(191) NULL,
    ADD COLUMN `faultConfirmed` BOOLEAN NULL,
    ADD COLUMN `cause` TEXT NULL,
    ADD COLUMN `action` VARCHAR(191) NULL,
    ADD COLUMN `laborMinutes` INTEGER NULL,
    ADD COLUMN `softwareBefore` VARCHAR(191) NULL,
    ADD COLUMN `softwareAfter` VARCHAR(191) NULL,
    ADD COLUMN `functionTestPassed` BOOLEAN NULL,
    ADD COLUMN `safetyRelevant` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `result` ENUM('repaired', 'provisional', 'not_repairable', 'parts_ordered') NULL,
    ADD COLUMN `resultText` TEXT NULL,
    ADD COLUMN `postRepairCheck` ENUM('mandatory', 'proposed', 'not_needed') NULL;

CREATE UNIQUE INDEX `MaintenanceEvent_inspectionRunId_key` ON `MaintenanceEvent`(`inspectionRunId`);
CREATE INDEX `MaintenanceEvent_tenantId_serviceRequestId_idx` ON `MaintenanceEvent`(`tenantId`, `serviceRequestId`);
ALTER TABLE `MaintenanceEvent` ADD CONSTRAINT `MaintenanceEvent_serviceRequestId_fkey` FOREIGN KEY (`serviceRequestId`) REFERENCES `ServiceRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `MaintenancePart` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `maintenanceEventId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `partNo` VARCHAR(191) NULL,
    `serialNo` VARCHAR(191) NULL,
    `qty` INTEGER NOT NULL DEFAULT 1,

    INDEX `MaintenancePart_maintenanceEventId_idx`(`maintenanceEventId`),
    INDEX `MaintenancePart_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MaintenancePart` ADD CONSTRAINT `MaintenancePart_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `MaintenancePart` ADD CONSTRAINT `MaintenancePart_maintenanceEventId_fkey` FOREIGN KEY (`maintenanceEventId`) REFERENCES `MaintenanceEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `Quote` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `serviceRequestId` VARCHAR(191) NOT NULL,
    `scopeText` TEXT NOT NULL,
    `amountText` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decision` ENUM('open', 'approved', 'rejected') NOT NULL DEFAULT 'open',
    `decidedBy` VARCHAR(191) NULL,
    `decidedByUserId` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `decisionNote` TEXT NULL,

    UNIQUE INDEX `Quote_serviceRequestId_key`(`serviceRequestId`),
    INDEX `Quote_tenantId_decision_idx`(`tenantId`, `decision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Quote` ADD CONSTRAINT `Quote_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_serviceRequestId_fkey` FOREIGN KEY (`serviceRequestId`) REFERENCES `ServiceRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `RefInspectionStep`
    ADD COLUMN `inputKind` ENUM('check', 'text', 'select', 'parts', 'number', 'measurement', 'result') NOT NULL DEFAULT 'check',
    ADD COLUMN `optionsJson` JSON NULL;

ALTER TABLE `InspectionStepResult`
    ADD COLUMN `valueJson` JSON NULL;
