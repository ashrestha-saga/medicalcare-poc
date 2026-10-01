-- Betreiberkonsole foundation: disposition fields, staff assignment, AVV, Fremdprüfer, executor↔org link.

-- AlterEnum: add scheduled to ServiceRequestState
ALTER TABLE `ServiceRequest` MODIFY `state` ENUM('captured', 'queued', 'transmitted', 'acknowledged', 'scheduled', 'in_progress', 'completed', 'rejected') NOT NULL DEFAULT 'captured';

-- AlterTable ServiceRequest
ALTER TABLE `ServiceRequest` ADD COLUMN `assigneeUserId` VARCHAR(191) NULL,
    ADD COLUMN `scheduledAt` DATE NULL;

-- AlterTable ServiceContract
ALTER TABLE `ServiceContract` ADD COLUMN `avvRef` VARCHAR(191) NULL;

-- AlterTable OrgMembership (Fremdprüfer)
ALTER TABLE `OrgMembership` ADD COLUMN `isExternal` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `commissionedFrom` DATE NULL,
    ADD COLUMN `commissionedTo` DATE NULL,
    ADD COLUMN `liabilityUntil` DATE NULL,
    ADD COLUMN `liabilitySumEur` INTEGER NULL;

-- AlterTable ExecutorOrg
ALTER TABLE `ExecutorOrg` ADD COLUMN `organisationId` VARCHAR(191) NULL;

-- CreateTable PartnerStaffAssignment
CREATE TABLE `PartnerStaffAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `membershipId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PartnerStaffAssignment_membershipId_tenantId_key`(`membershipId`, `tenantId`),
    INDEX `PartnerStaffAssignment_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Indexes
CREATE INDEX `ServiceRequest_tenantId_assigneeUserId_idx` ON `ServiceRequest`(`tenantId`, `assigneeUserId`);
CREATE INDEX `OrgMembership_organisationId_isExternal_idx` ON `OrgMembership`(`organisationId`, `isExternal`);
CREATE INDEX `ExecutorOrg_organisationId_idx` ON `ExecutorOrg`(`organisationId`);

-- Foreign keys
ALTER TABLE `ServiceRequest` ADD CONSTRAINT `ServiceRequest_assigneeUserId_fkey` FOREIGN KEY (`assigneeUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `PartnerStaffAssignment` ADD CONSTRAINT `PartnerStaffAssignment_membershipId_fkey` FOREIGN KEY (`membershipId`) REFERENCES `OrgMembership`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PartnerStaffAssignment` ADD CONSTRAINT `PartnerStaffAssignment_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ExecutorOrg` ADD CONSTRAINT `ExecutorOrg_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
