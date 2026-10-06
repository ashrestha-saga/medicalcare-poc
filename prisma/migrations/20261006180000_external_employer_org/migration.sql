-- Fremdprüfer employer organisation (foreign firm), distinct from commissioning org.
ALTER TABLE `OrgMembership` ADD COLUMN `employerOrganisationId` VARCHAR(191) NULL;

CREATE INDEX `OrgMembership_employerOrganisationId_idx` ON `OrgMembership`(`employerOrganisationId`);

ALTER TABLE `OrgMembership` ADD CONSTRAINT `OrgMembership_employerOrganisationId_fkey` FOREIGN KEY (`employerOrganisationId`) REFERENCES `Organisation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
