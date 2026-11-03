-- AlterTable
ALTER TABLE `DeviceClarification` ADD COLUMN `inspectionRunId` VARCHAR(191) NULL,
    ADD COLUMN `raisedByOrganisationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `DeviceInstance` ADD COLUMN `lockReason` TEXT NULL,
    ADD COLUMN `lockedAt` DATETIME(3) NULL,
    ADD COLUMN `lockedByRunId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `FieldSafetyAction` ADD COLUMN `rolloutKey` VARCHAR(191) NULL,
    ADD COLUMN `sourceOrganisationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `InspectionRun` ADD COLUMN `visitId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `InspectionStepResult` ADD COLUMN `noPhotoReason` TEXT NULL,
    ADD COLUMN `recordedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `OrgMembership` MODIFY `appRole` ENUM('inspector', 'admin', 'order', 'management') NOT NULL;

-- AlterTable
ALTER TABLE `RefInspectionCatalogue` ADD COLUMN `draftReasons` JSON NULL;

-- AlterTable
ALTER TABLE `ServiceRequest` ADD COLUMN `followUpNeeds` TEXT NULL,
    ADD COLUMN `followUpUrgency` VARCHAR(191) NULL,
    ADD COLUMN `parentRequestId` VARCHAR(191) NULL,
    ADD COLUMN `proposedByOrgId` VARCHAR(191) NULL,
    ADD COLUMN `reason` ENUM('faelligkeit', 'befund', 'rueckruf', 'stoerung', 'instandsetzung') NOT NULL DEFAULT 'faelligkeit',
    ADD COLUMN `reasonDueDate` DATE NULL,
    ADD COLUMN `visitId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `TestEquipment` ADD COLUMN `assignedMembershipId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `UserInvitation` MODIFY `appRole` ENUM('inspector', 'admin', 'order', 'management') NULL;

-- CreateTable
CREATE TABLE `ServiceVisit` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NULL,
    `plannedAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `technicianUserId` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ServiceVisit_tenantId_organisationId_idx`(`tenantId`, `organisationId`),
    INDEX `ServiceVisit_organisationId_plannedAt_idx`(`organisationId`, `plannedAt`),
    INDEX `ServiceVisit_technicianUserId_idx`(`technicianUserId`),
    INDEX `ServiceVisit_siteId_idx`(`siteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InspectionSignature` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `signerName` VARCHAR(191) NULL,
    `signerRole` VARCHAR(191) NULL,
    `blobId` VARCHAR(191) NULL,
    `signedAt` DATETIME(3) NULL,
    `absent` BOOLEAN NOT NULL DEFAULT false,
    `absentReason` TEXT NULL,

    UNIQUE INDEX `InspectionSignature_runId_kind_key`(`runId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InspectionStepAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `resultId` VARCHAR(191) NOT NULL,
    `blobId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'mangelbild',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InspectionStepAttachment_resultId_idx`(`resultId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InspectionRunNote` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `patientRelevance` BOOLEAN NOT NULL DEFAULT false,
    `blobId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InspectionRunNote_runId_idx`(`runId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NavUsage` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NULL,
    `surface` VARCHAR(191) NOT NULL,
    `navKey` VARCHAR(191) NOT NULL,
    `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `useCount` INTEGER NOT NULL DEFAULT 1,

    INDEX `NavUsage_userId_surface_lastUsedAt_idx`(`userId`, `surface`, `lastUsedAt`),
    INDEX `NavUsage_organisationId_idx`(`organisationId`),
    UNIQUE INDEX `NavUsage_userId_surface_navKey_key`(`userId`, `surface`, `navKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserPreference` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NULL,
    `scope` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserPreference_userId_organisationId_idx`(`userId`, `organisationId`),
    UNIQUE INDEX `UserPreference_userId_scope_key_key`(`userId`, `scope`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `DeviceClarification_inspectionRunId_idx` ON `DeviceClarification`(`inspectionRunId`);

-- CreateIndex
CREATE INDEX `DeviceClarification_raisedByOrganisationId_idx` ON `DeviceClarification`(`raisedByOrganisationId`);

-- CreateIndex
CREATE INDEX `DeviceInstance_lockedAt_idx` ON `DeviceInstance`(`lockedAt`);

-- CreateIndex
CREATE INDEX `FieldSafetyAction_rolloutKey_idx` ON `FieldSafetyAction`(`rolloutKey`);

-- CreateIndex
CREATE INDEX `FieldSafetyAction_sourceOrganisationId_idx` ON `FieldSafetyAction`(`sourceOrganisationId`);

-- CreateIndex
CREATE INDEX `InspectionRun_visitId_idx` ON `InspectionRun`(`visitId`);

-- CreateIndex
CREATE INDEX `ServiceRequest_tenantId_visitId_idx` ON `ServiceRequest`(`tenantId`, `visitId`);

-- CreateIndex
CREATE INDEX `ServiceRequest_parentRequestId_idx` ON `ServiceRequest`(`parentRequestId`);

-- CreateIndex
CREATE INDEX `ServiceRequest_proposedByOrgId_idx` ON `ServiceRequest`(`proposedByOrgId`);

-- CreateIndex
CREATE INDEX `TestEquipment_assignedMembershipId_idx` ON `TestEquipment`(`assignedMembershipId`);

-- AddForeignKey
ALTER TABLE `ServiceRequest` ADD CONSTRAINT `ServiceRequest_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `ServiceVisit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceRequest` ADD CONSTRAINT `ServiceRequest_parentRequestId_fkey` FOREIGN KEY (`parentRequestId`) REFERENCES `ServiceRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceRequest` ADD CONSTRAINT `ServiceRequest_proposedByOrgId_fkey` FOREIGN KEY (`proposedByOrgId`) REFERENCES `Organisation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceVisit` ADD CONSTRAINT `ServiceVisit_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceVisit` ADD CONSTRAINT `ServiceVisit_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceVisit` ADD CONSTRAINT `ServiceVisit_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceVisit` ADD CONSTRAINT `ServiceVisit_technicianUserId_fkey` FOREIGN KEY (`technicianUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceClarification` ADD CONSTRAINT `DeviceClarification_inspectionRunId_fkey` FOREIGN KEY (`inspectionRunId`) REFERENCES `InspectionRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TestEquipment` ADD CONSTRAINT `TestEquipment_assignedMembershipId_fkey` FOREIGN KEY (`assignedMembershipId`) REFERENCES `OrgMembership`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InspectionRun` ADD CONSTRAINT `InspectionRun_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `ServiceVisit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InspectionSignature` ADD CONSTRAINT `InspectionSignature_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `InspectionRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InspectionStepAttachment` ADD CONSTRAINT `InspectionStepAttachment_resultId_fkey` FOREIGN KEY (`resultId`) REFERENCES `InspectionStepResult`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InspectionRunNote` ADD CONSTRAINT `InspectionRunNote_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `InspectionRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FieldSafetyAction` ADD CONSTRAINT `FieldSafetyAction_sourceOrganisationId_fkey` FOREIGN KEY (`sourceOrganisationId`) REFERENCES `Organisation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NavUsage` ADD CONSTRAINT `NavUsage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserPreference` ADD CONSTRAINT `UserPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
