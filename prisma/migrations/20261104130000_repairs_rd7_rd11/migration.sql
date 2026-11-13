-- Repairs package increment 2: RD7–RD11 (E76–E80)

ALTER TABLE `MaintenanceEvent`
    ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'internal',
    ADD COLUMN `externalPerformer` VARCHAR(191) NULL,
    ADD COLUMN `reportBlobId` VARCHAR(191) NULL,
    ADD COLUMN `followUpSkippedReason` TEXT NULL;

CREATE INDEX `MaintenanceEvent_reportBlobId_idx` ON `MaintenanceEvent`(`reportBlobId`);
ALTER TABLE `MaintenanceEvent` ADD CONSTRAINT `MaintenanceEvent_reportBlobId_fkey` FOREIGN KEY (`reportBlobId`) REFERENCES `AttachmentBlob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ServiceRequest`
    ADD COLUMN `checkType` ENUM('stk', 'mtk', 'requalification', 'acceptance_constancy') NULL,
    ADD COLUMN `fulfilment` ENUM('on_site', 'send_in') NOT NULL DEFAULT 'on_site',
    ADD COLUMN `shippedAt` DATE NULL,
    ADD COLUMN `trackingRef` VARCHAR(191) NULL,
    ADD COLUMN `atWorkshopAt` DATE NULL,
    ADD COLUMN `returnedAt` DATE NULL,
    ADD COLUMN `arrivedAt` DATE NULL,
    ADD COLUMN `gateOverriddenBy` VARCHAR(191) NULL,
    ADD COLUMN `gateOverriddenByUserId` VARCHAR(191) NULL,
    ADD COLUMN `gateOverriddenAt` DATETIME(3) NULL,
    ADD COLUMN `gateOverrideReason` TEXT NULL;

CREATE TABLE `ManufacturerTrainingGate` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `manufacturer` VARCHAR(191) NOT NULL,
    `gate` VARCHAR(191) NOT NULL DEFAULT 'hint',
    `setBy` VARCHAR(191) NOT NULL,
    `setAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ManufacturerTrainingGate_organisationId_manufacturer_key`(`organisationId`, `manufacturer`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ManufacturerTrainingGate` ADD CONSTRAINT `ManufacturerTrainingGate_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `PartsOrderProposal` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `serviceRequestId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'open',
    `channel` VARCHAR(191) NOT NULL DEFAULT 'plusorder',
    `triggeredVia` VARCHAR(191) NOT NULL DEFAULT 'devicecare',
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `orderedAt` DATETIME(3) NULL,
    `orderRef` VARCHAR(191) NULL,
    `discardReason` TEXT NULL,

    INDEX `PartsOrderProposal_organisationId_status_idx`(`organisationId`, `status`),
    INDEX `PartsOrderProposal_serviceRequestId_idx`(`serviceRequestId`),
    INDEX `PartsOrderProposal_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PartsOrderProposal` ADD CONSTRAINT `PartsOrderProposal_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PartsOrderProposal` ADD CONSTRAINT `PartsOrderProposal_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `PartsOrderProposal` ADD CONSTRAINT `PartsOrderProposal_serviceRequestId_fkey` FOREIGN KEY (`serviceRequestId`) REFERENCES `ServiceRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `PartsOrderProposalLine` (
    `id` VARCHAR(191) NOT NULL,
    `proposalId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `partNo` VARCHAR(191) NULL,
    `serialNo` VARCHAR(191) NULL,
    `qty` INTEGER NOT NULL DEFAULT 1,

    INDEX `PartsOrderProposalLine_proposalId_idx`(`proposalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PartsOrderProposalLine` ADD CONSTRAINT `PartsOrderProposalLine_proposalId_fkey` FOREIGN KEY (`proposalId`) REFERENCES `PartsOrderProposal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
