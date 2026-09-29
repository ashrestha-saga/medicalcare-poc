ALTER TABLE `Tenant` ADD COLUMN `code` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `Tenant_code_key` ON `Tenant`(`code`);
ALTER TABLE `Tenant` ADD COLUMN `operatingModel` VARCHAR(191) NOT NULL DEFAULT 'institution_operated';

ALTER TABLE `ServiceContract` ADD COLUMN `billingRef` VARCHAR(191) NULL;
