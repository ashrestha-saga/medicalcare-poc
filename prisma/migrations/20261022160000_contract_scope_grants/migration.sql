-- Phase 8: ServiceContractScopeGrant (dual-read with legacy ServiceContract.scope JSON).

CREATE TABLE `ServiceContractScopeGrant` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `permission` VARCHAR(191) NOT NULL,
    `denied` BOOLEAN NOT NULL DEFAULT false,
    `source` VARCHAR(191) NOT NULL DEFAULT 'token',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `ServiceContractScopeGrant_contractId_permission_key`(`contractId`, `permission`),
    INDEX `ServiceContractScopeGrant_contractId_denied_idx`(`contractId`, `denied`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ServiceContractScopeGrant` ADD CONSTRAINT `ServiceContractScopeGrant_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ServiceContract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
