-- D14–D16 · Authority Begehung v26.1 (E66–E69)

-- D15 · Finding dispute fields
ALTER TABLE `AuthorityFinding`
  ADD COLUMN `disputedAt` DATE NULL,
  ADD COLUMN `disputedReason` TEXT NULL;

-- D16 · DisclosureSession extras
ALTER TABLE `DisclosureSession`
  ADD COLUMN `siteId` VARCHAR(191) NULL,
  ADD COLUMN `checklistCode` VARCHAR(191) NULL,
  ADD COLUMN `participants` TEXT NULL,
  ADD COLUMN `autoClosed` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `DisclosureSession_siteId_idx` ON `DisclosureSession`(`siteId`);
CREATE INDEX `DisclosureSession_checklistCode_idx` ON `DisclosureSession`(`checklistCode`);

ALTER TABLE `DisclosureSession`
  ADD CONSTRAINT `DisclosureSession_siteId_fkey`
    FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DisclosureSession`
  ADD CONSTRAINT `DisclosureSession_checklistCode_fkey`
    FOREIGN KEY (`checklistCode`) REFERENCES `RefAuthorityChecklist`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- D14 · ChecklistItemReadiness
CREATE TABLE `ChecklistItemReadiness` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `externalReady` BOOLEAN NOT NULL DEFAULT false,
  `documentRef` TEXT NULL,
  `checkedBy` VARCHAR(191) NOT NULL,
  `checkedByUserId` VARCHAR(191) NULL,
  `checkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `ChecklistItemReadiness_tenantId_itemId_key` ON `ChecklistItemReadiness`(`tenantId`, `itemId`);
CREATE INDEX `ChecklistItemReadiness_tenantId_idx` ON `ChecklistItemReadiness`(`tenantId`);
CREATE INDEX `ChecklistItemReadiness_checkedByUserId_idx` ON `ChecklistItemReadiness`(`checkedByUserId`);

ALTER TABLE `ChecklistItemReadiness`
  ADD CONSTRAINT `ChecklistItemReadiness_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ChecklistItemReadiness`
  ADD CONSTRAINT `ChecklistItemReadiness_itemId_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `RefAuthorityChecklistItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ChecklistItemReadiness`
  ADD CONSTRAINT `ChecklistItemReadiness_checkedByUserId_fkey`
    FOREIGN KEY (`checkedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
