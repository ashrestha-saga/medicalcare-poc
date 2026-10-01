-- SWOT finishing: link history, enums on load-bearing strings, termMatchConfidence rename.

-- OrganisationRole.role → OrganisationCapacity
ALTER TABLE `OrganisationRole` MODIFY `role` ENUM('institution', 'service_provider', 'inspection_partner', 'platform_operator') NOT NULL;

-- User.role → ClinicRole (nullable for partners)
ALTER TABLE `User` MODIFY `role` ENUM('superadmin', 'device_admin', 'security_officer', 'user') NULL;

-- DutyPerformance.result
ALTER TABLE `DutyPerformance` MODIFY `result` ENUM('passed', 'passed_with_conditions', 'failed') NOT NULL DEFAULT 'passed';

-- OrderRequest approval + lifecycle
ALTER TABLE `OrderRequest` MODIFY `approvalState` ENUM('pending_approval', 'approved', 'rejected') NOT NULL DEFAULT 'pending_approval';
ALTER TABLE `OrderRequest` MODIFY `state` ENUM('captured') NOT NULL DEFAULT 'captured';

-- RefAnnex2Item: matchConfidence → termMatchConfidence (Confidence enum)
ALTER TABLE `RefAnnex2Item` ADD COLUMN `termMatchConfidence` ENUM('verified', 'responsible', 'determination', 'derived', 'not_applicable', 'guess') NOT NULL DEFAULT 'derived';
UPDATE `RefAnnex2Item` SET `termMatchConfidence` = CASE
  WHEN `matchConfidence` IN ('verified', 'responsible', 'determination', 'derived', 'not_applicable', 'guess') THEN `matchConfidence`
  ELSE 'derived'
END;
ALTER TABLE `RefAnnex2Item` DROP COLUMN `matchConfidence`;

-- ReprocessingOnDevice history (close instead of delete).
-- MySQL may use the composite unique for FKs — add standalone indexes first.
CREATE INDEX `ReprocessingOnDevice_profileDeviceId_idx` ON `ReprocessingOnDevice`(`profileDeviceId`);
CREATE INDEX `ReprocessingOnDevice_equipmentDeviceId_idx` ON `ReprocessingOnDevice`(`equipmentDeviceId`);
ALTER TABLE `ReprocessingOnDevice` DROP INDEX `ReprocessingOnDevice_profileDeviceId_equipmentDeviceId_key`;
ALTER TABLE `ReprocessingOnDevice` ADD COLUMN `validFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
ALTER TABLE `ReprocessingOnDevice` ADD COLUMN `validTo` DATETIME(3) NULL;
CREATE INDEX `ReprocessingOnDevice_tenantId_profileDeviceId_validTo_idx` ON `ReprocessingOnDevice`(`tenantId`, `profileDeviceId`, `validTo`);
CREATE INDEX `ReprocessingOnDevice_tenantId_equipmentDeviceId_validTo_idx` ON `ReprocessingOnDevice`(`tenantId`, `equipmentDeviceId`, `validTo`);
CREATE INDEX `ReprocessingOnDevice_profileDeviceId_equipmentDeviceId_idx` ON `ReprocessingOnDevice`(`profileDeviceId`, `equipmentDeviceId`);
