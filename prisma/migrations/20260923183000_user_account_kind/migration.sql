-- Clinic vs partner login identity.
-- Clinic users keep tenantId + role. Partner users leave both null.

ALTER TABLE `User` DROP FOREIGN KEY `User_tenantId_fkey`;
ALTER TABLE `User` DROP INDEX `User_tenantId_email_key`;
ALTER TABLE `User` DROP INDEX `User_email_idx`;

ALTER TABLE `User`
  MODIFY `tenantId` VARCHAR(191) NULL,
  MODIFY `role` VARCHAR(191) NULL,
  ADD COLUMN `accountKind` VARCHAR(191) NOT NULL DEFAULT 'clinic',
  ADD COLUMN `jobTitle` VARCHAR(191) NULL,
  ADD COLUMN `homeAreaId` VARCHAR(191) NULL,
  ADD COLUMN `employedFrom` DATE NULL,
  ADD COLUMN `employedTo` DATE NULL,
  ADD COLUMN `anonymisedAt` DATETIME(3) NULL;

ALTER TABLE `User` ADD CONSTRAINT `User_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `User` ADD CONSTRAINT `User_homeAreaId_fkey`
  FOREIGN KEY (`homeAreaId`) REFERENCES `Area`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX `User_email_key` ON `User`(`email`);
CREATE INDEX `User_accountKind_idx` ON `User`(`accountKind`);
CREATE INDEX `User_homeAreaId_idx` ON `User`(`homeAreaId`);

CREATE TABLE `Organisation` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `contact` VARCHAR(191) NULL,
  `activeFrom` DATE NOT NULL,
  `activeTo` DATE NULL,
  UNIQUE INDEX `Organisation_code_key`(`code`),
  INDEX `Organisation_activeTo_idx`(`activeTo`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrgMembership` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `organisationId` VARCHAR(191) NOT NULL,
  `appRole` VARCHAR(191) NOT NULL,
  `validFrom` DATE NOT NULL,
  `validTo` DATE NULL,
  UNIQUE INDEX `OrgMembership_organisationId_userId_key`(`organisationId`, `userId`),
  INDEX `OrgMembership_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ServiceContract` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `organisationId` VARCHAR(191) NOT NULL,
  `validFrom` DATE NOT NULL,
  `validTo` DATE NULL,
  `scope` TEXT NOT NULL,
  UNIQUE INDEX `ServiceContract_tenantId_organisationId_key`(`tenantId`, `organisationId`),
  INDEX `ServiceContract_organisationId_idx`(`organisationId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OrgMembership` ADD CONSTRAINT `OrgMembership_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `OrgMembership` ADD CONSTRAINT `OrgMembership_organisationId_fkey`
  FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ServiceContract` ADD CONSTRAINT `ServiceContract_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ServiceContract` ADD CONSTRAINT `ServiceContract_organisationId_fkey`
  FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
