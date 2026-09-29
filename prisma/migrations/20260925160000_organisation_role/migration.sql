-- Organisation capacity (institution | service_provider | inspection_partner | platform_operator).
-- Contract lifecycle timestamps. Optional tenant → institution organisation link.

CREATE TABLE `OrganisationRole` (
  `id` VARCHAR(191) NOT NULL,
  `organisationId` VARCHAR(191) NOT NULL,
  `role` VARCHAR(191) NOT NULL,
  `grantedFrom` DATE NOT NULL,
  `grantedTo` DATE NULL,
  UNIQUE INDEX `OrganisationRole_organisationId_role_key`(`organisationId`, `role`),
  INDEX `OrganisationRole_role_grantedTo_idx`(`role`, `grantedTo`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OrganisationRole` ADD CONSTRAINT `OrganisationRole_organisationId_fkey`
  FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ServiceContract` ADD COLUMN `terminatedAt` DATETIME(3) NULL;
ALTER TABLE `ServiceContract` ADD COLUMN `suspendedAt` DATETIME(3) NULL;

ALTER TABLE `Tenant` ADD COLUMN `institutionOrgId` VARCHAR(191) NULL;
CREATE INDEX `Tenant_institutionOrgId_idx` ON `Tenant`(`institutionOrgId`);
ALTER TABLE `Tenant` ADD CONSTRAINT `Tenant_institutionOrgId_fkey`
  FOREIGN KEY (`institutionOrgId`) REFERENCES `Organisation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
