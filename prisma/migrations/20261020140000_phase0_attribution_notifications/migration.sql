-- Phase 0: attribution UserId FKs, device retention, AuthorityNotification.

-- DeviceInstance retention (§ 13)
ALTER TABLE `DeviceInstance` ADD COLUMN `decommissionedAt` DATE NULL;
ALTER TABLE `DeviceInstance` ADD COLUMN `retainUntil` DATE NULL;
CREATE INDEX `DeviceInstance_tenantId_retainUntil_idx` ON `DeviceInstance`(`tenantId`, `retainUntil`);

-- DeviceBookEntry
ALTER TABLE `DeviceBookEntry` ADD COLUMN `recordedByUserId` VARCHAR(191) NULL;
CREATE INDEX `DeviceBookEntry_recordedByUserId_idx` ON `DeviceBookEntry`(`recordedByUserId`);
ALTER TABLE `DeviceBookEntry` ADD CONSTRAINT `DeviceBookEntry_recordedByUserId_fkey` FOREIGN KEY (`recordedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- DeviceIncident
ALTER TABLE `DeviceIncident` ADD COLUMN `assessedByUserId` VARCHAR(191) NULL;
ALTER TABLE `DeviceIncident` ADD COLUMN `closedByUserId` VARCHAR(191) NULL;
ALTER TABLE `DeviceIncident` ADD COLUMN `recordedByUserId` VARCHAR(191) NULL;
CREATE INDEX `DeviceIncident_recordedByUserId_idx` ON `DeviceIncident`(`recordedByUserId`);
CREATE INDEX `DeviceIncident_assessedByUserId_idx` ON `DeviceIncident`(`assessedByUserId`);
CREATE INDEX `DeviceIncident_closedByUserId_idx` ON `DeviceIncident`(`closedByUserId`);
ALTER TABLE `DeviceIncident` ADD CONSTRAINT `DeviceIncident_assessedByUserId_fkey` FOREIGN KEY (`assessedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DeviceIncident` ADD CONSTRAINT `DeviceIncident_closedByUserId_fkey` FOREIGN KEY (`closedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DeviceIncident` ADD CONSTRAINT `DeviceIncident_recordedByUserId_fkey` FOREIGN KEY (`recordedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- FieldSafetyAction
ALTER TABLE `FieldSafetyAction` ADD COLUMN `recordedByUserId` VARCHAR(191) NULL;
CREATE INDEX `FieldSafetyAction_recordedByUserId_idx` ON `FieldSafetyAction`(`recordedByUserId`);
ALTER TABLE `FieldSafetyAction` ADD CONSTRAINT `FieldSafetyAction_recordedByUserId_fkey` FOREIGN KEY (`recordedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- FieldSafetyDeviceAction
ALTER TABLE `FieldSafetyDeviceAction` ADD COLUMN `recordedByUserId` VARCHAR(191) NULL;
CREATE INDEX `FieldSafetyDeviceAction_recordedByUserId_idx` ON `FieldSafetyDeviceAction`(`recordedByUserId`);
ALTER TABLE `FieldSafetyDeviceAction` ADD CONSTRAINT `FieldSafetyDeviceAction_recordedByUserId_fkey` FOREIGN KEY (`recordedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ReprocessingBatch
ALTER TABLE `ReprocessingBatch` ADD COLUMN `recordedByUserId` VARCHAR(191) NULL;
CREATE INDEX `ReprocessingBatch_recordedByUserId_idx` ON `ReprocessingBatch`(`recordedByUserId`);
ALTER TABLE `ReprocessingBatch` ADD CONSTRAINT `ReprocessingBatch_recordedByUserId_fkey` FOREIGN KEY (`recordedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ConstancyCadence
ALTER TABLE `ConstancyCadence` ADD COLUMN `determinedByUserId` VARCHAR(191) NULL;
CREATE INDEX `ConstancyCadence_determinedByUserId_idx` ON `ConstancyCadence`(`determinedByUserId`);
ALTER TABLE `ConstancyCadence` ADD CONSTRAINT `ConstancyCadence_determinedByUserId_fkey` FOREIGN KEY (`determinedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AuthorityInspection
ALTER TABLE `AuthorityInspection` ADD COLUMN `recordedByUserId` VARCHAR(191) NULL;
CREATE INDEX `AuthorityInspection_recordedByUserId_idx` ON `AuthorityInspection`(`recordedByUserId`);
ALTER TABLE `AuthorityInspection` ADD CONSTRAINT `AuthorityInspection_recordedByUserId_fkey` FOREIGN KEY (`recordedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AuthorityFinding
ALTER TABLE `AuthorityFinding` ADD COLUMN `recordedByUserId` VARCHAR(191) NULL;
CREATE INDEX `AuthorityFinding_recordedByUserId_idx` ON `AuthorityFinding`(`recordedByUserId`);
ALTER TABLE `AuthorityFinding` ADD CONSTRAINT `AuthorityFinding_recordedByUserId_fkey` FOREIGN KEY (`recordedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AuthorityNotification + NotificationDocument

CREATE TABLE `AuthorityNotification` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `kind` ENUM('incident', 'finding_remediation', 'radiation', 'accident', 'metrology', 'other') NOT NULL,
    `state` ENUM('draft', 'sent', 'acknowledged', 'closed', 'withdrawn') NOT NULL DEFAULT 'draft',
    `authorityKind` ENUM('health_office', 'device_authority', 'occupational_safety', 'metrology', 'medical_board', 'other') NULL,
    `recipientName` VARCHAR(191) NOT NULL,
    `channel` ENUM('authority_portal', 'manufacturer_portal', 'email', 'post', 'fax', 'other') NOT NULL,
    `incidentId` VARCHAR(191) NULL,
    `findingId` VARCHAR(191) NULL,
    `deviceInstanceId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `subject` TEXT NOT NULL,
    `bodyText` TEXT NULL,
    `dueAt` DATE NULL,
    `sentAt` DATE NULL,
    `sentByUserId` VARCHAR(191) NULL,
    `sentByName` VARCHAR(191) NULL,
    `acknowledgedAt` DATE NULL,
    `reference` VARCHAR(191) NULL,
    `outcomeText` TEXT NULL,
    `closedAt` DATE NULL,
    `supersedesId` VARCHAR(191) NULL,
    `recordedByUserId` VARCHAR(191) NULL,
    `recordedByName` VARCHAR(191) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `NotificationDocument` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `notificationId` VARCHAR(191) NOT NULL,
    `role` ENUM('submission', 'acknowledgement', 'response', 'attachment') NOT NULL,
    `blobId` VARCHAR(191) NULL,
    `externalRef` VARCHAR(191) NULL,
    `addedByUserId` VARCHAR(191) NULL,
    `addedByName` VARCHAR(191) NOT NULL,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `AuthorityNotification_tenantId_kind_state_idx` ON `AuthorityNotification`(`tenantId`, `kind`, `state`);
CREATE INDEX `AuthorityNotification_tenantId_dueAt_idx` ON `AuthorityNotification`(`tenantId`, `dueAt`);
CREATE INDEX `AuthorityNotification_incidentId_idx` ON `AuthorityNotification`(`incidentId`);
CREATE INDEX `AuthorityNotification_findingId_idx` ON `AuthorityNotification`(`findingId`);
CREATE INDEX `AuthorityNotification_deviceInstanceId_idx` ON `AuthorityNotification`(`deviceInstanceId`);
CREATE INDEX `AuthorityNotification_siteId_idx` ON `AuthorityNotification`(`siteId`);
CREATE INDEX `AuthorityNotification_sentByUserId_idx` ON `AuthorityNotification`(`sentByUserId`);
CREATE INDEX `AuthorityNotification_recordedByUserId_idx` ON `AuthorityNotification`(`recordedByUserId`);

CREATE INDEX `NotificationDocument_notificationId_idx` ON `NotificationDocument`(`notificationId`);
CREATE INDEX `NotificationDocument_tenantId_idx` ON `NotificationDocument`(`tenantId`);
CREATE INDEX `NotificationDocument_blobId_idx` ON `NotificationDocument`(`blobId`);

ALTER TABLE `AuthorityNotification` ADD CONSTRAINT `AuthorityNotification_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AuthorityNotification` ADD CONSTRAINT `AuthorityNotification_incidentId_fkey` FOREIGN KEY (`incidentId`) REFERENCES `DeviceIncident`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuthorityNotification` ADD CONSTRAINT `AuthorityNotification_findingId_fkey` FOREIGN KEY (`findingId`) REFERENCES `AuthorityFinding`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuthorityNotification` ADD CONSTRAINT `AuthorityNotification_deviceInstanceId_fkey` FOREIGN KEY (`deviceInstanceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuthorityNotification` ADD CONSTRAINT `AuthorityNotification_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuthorityNotification` ADD CONSTRAINT `AuthorityNotification_sentByUserId_fkey` FOREIGN KEY (`sentByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuthorityNotification` ADD CONSTRAINT `AuthorityNotification_supersedesId_fkey` FOREIGN KEY (`supersedesId`) REFERENCES `AuthorityNotification`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuthorityNotification` ADD CONSTRAINT `AuthorityNotification_recordedByUserId_fkey` FOREIGN KEY (`recordedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `NotificationDocument` ADD CONSTRAINT `NotificationDocument_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `NotificationDocument` ADD CONSTRAINT `NotificationDocument_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `AuthorityNotification`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NotificationDocument` ADD CONSTRAINT `NotificationDocument_blobId_fkey` FOREIGN KEY (`blobId`) REFERENCES `AttachmentBlob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: when legacy *By fields hold a User.id, set the FK (name stays as stored).
UPDATE `DeviceBookEntry` e
  INNER JOIN `User` u ON u.id = e.recordedBy
  SET e.recordedByUserId = u.id;

UPDATE `DeviceIncident` i
  INNER JOIN `User` u ON u.id = i.recordedBy
  SET i.recordedByUserId = u.id;

UPDATE `DeviceIncident` i
  INNER JOIN `User` u ON u.id = i.assessedBy
  SET i.assessedByUserId = u.id;

UPDATE `DeviceIncident` i
  INNER JOIN `User` u ON u.id = i.closedBy
  SET i.closedByUserId = u.id;

UPDATE `FieldSafetyAction` f
  INNER JOIN `User` u ON u.id = f.recordedBy
  SET f.recordedByUserId = u.id;

UPDATE `FieldSafetyDeviceAction` f
  INNER JOIN `User` u ON u.id = f.recordedBy
  SET f.recordedByUserId = u.id;

UPDATE `ReprocessingBatch` b
  INNER JOIN `User` u ON u.id = b.recordedBy
  SET b.recordedByUserId = u.id;

UPDATE `ConstancyCadence` c
  INNER JOIN `User` u ON u.id = c.determinedBy
  SET c.determinedByUserId = u.id;

UPDATE `AuthorityInspection` a
  INNER JOIN `User` u ON u.id = a.recordedBy
  SET a.recordedByUserId = u.id;

UPDATE `AuthorityFinding` a
  INNER JOIN `User` u ON u.id = a.recordedBy
  SET a.recordedByUserId = u.id;
