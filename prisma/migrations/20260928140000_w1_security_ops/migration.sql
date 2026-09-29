-- W1 Security / Ops: SEC-02 tenantId backfills, SCH-01/02, auth fields,
-- OXID token encryption rename, DutyReminder, DispatchOutbox, AuditEvent triggers.

-- ---------------------------------------------------------------------------
-- User: session revoke + lockout (SEC-03 / SEC-04)
-- ---------------------------------------------------------------------------
ALTER TABLE `User`
  ADD COLUMN `sessionsValidFrom` DATETIME(3) NULL,
  ADD COLUMN `failedLoginAttempts` INT NOT NULL DEFAULT 0,
  ADD COLUMN `lockedUntil` DATETIME(3) NULL;

-- ---------------------------------------------------------------------------
-- OXID tokens → encrypted fields (SEC-05)
-- Dual-read in app: encryptSecretOrPlain accepts plaintext during rollout.
-- ---------------------------------------------------------------------------
ALTER TABLE `TenantOxidConnection`
  CHANGE COLUMN `accessToken` `accessTokenEnc` TEXT NULL,
  CHANGE COLUMN `refreshToken` `refreshTokenEnc` TEXT NULL;

-- ---------------------------------------------------------------------------
-- SEC-02: Area.tenantId
-- ---------------------------------------------------------------------------
ALTER TABLE `Area` ADD COLUMN `tenantId` VARCHAR(191) NULL;
UPDATE `Area` a
  INNER JOIN `Site` s ON s.id = a.siteId
  SET a.tenantId = s.tenantId;
ALTER TABLE `Area` MODIFY `tenantId` VARCHAR(191) NOT NULL;
CREATE INDEX `Area_tenantId_idx` ON `Area`(`tenantId`);
ALTER TABLE `Area`
  ADD CONSTRAINT `Area_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- SEC-02: SiteHeadcount.tenantId
-- ---------------------------------------------------------------------------
ALTER TABLE `SiteHeadcount` ADD COLUMN `tenantId` VARCHAR(191) NULL;
UPDATE `SiteHeadcount` h
  INNER JOIN `Site` s ON s.id = h.siteId
  SET h.tenantId = s.tenantId;
ALTER TABLE `SiteHeadcount` MODIFY `tenantId` VARCHAR(191) NOT NULL;
CREATE INDEX `SiteHeadcount_tenantId_idx` ON `SiteHeadcount`(`tenantId`);
ALTER TABLE `SiteHeadcount`
  ADD CONSTRAINT `SiteHeadcount_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- SEC-02: SafetyOfficerAppointment.tenantId
-- ---------------------------------------------------------------------------
ALTER TABLE `SafetyOfficerAppointment` ADD COLUMN `tenantId` VARCHAR(191) NULL;
UPDATE `SafetyOfficerAppointment` o
  INNER JOIN `Site` s ON s.id = o.siteId
  SET o.tenantId = s.tenantId;
ALTER TABLE `SafetyOfficerAppointment` MODIFY `tenantId` VARCHAR(191) NOT NULL;
CREATE INDEX `SafetyOfficerAppointment_tenantId_idx` ON `SafetyOfficerAppointment`(`tenantId`);
ALTER TABLE `SafetyOfficerAppointment`
  ADD CONSTRAINT `SafetyOfficerAppointment_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- SEC-02: StatusEvent.tenantId
-- ---------------------------------------------------------------------------
ALTER TABLE `StatusEvent` ADD COLUMN `tenantId` VARCHAR(191) NULL;
UPDATE `StatusEvent` e
  INNER JOIN `ServiceRequest` r ON r.id = e.serviceRequestId
  SET e.tenantId = r.tenantId;
ALTER TABLE `StatusEvent` MODIFY `tenantId` VARCHAR(191) NOT NULL;
CREATE INDEX `StatusEvent_tenantId_idx` ON `StatusEvent`(`tenantId`);
ALTER TABLE `StatusEvent`
  ADD CONSTRAINT `StatusEvent_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- SEC-02: Attachment.tenantId
-- ---------------------------------------------------------------------------
ALTER TABLE `Attachment` ADD COLUMN `tenantId` VARCHAR(191) NULL;
UPDATE `Attachment` a
  INNER JOIN `ServiceRequest` r ON r.id = a.serviceRequestId
  SET a.tenantId = r.tenantId;
ALTER TABLE `Attachment` MODIFY `tenantId` VARCHAR(191) NOT NULL;
CREATE INDEX `Attachment_tenantId_idx` ON `Attachment`(`tenantId`);
ALTER TABLE `Attachment`
  ADD CONSTRAINT `Attachment_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- SEC-02: DispatchRecord.tenantId
-- ---------------------------------------------------------------------------
ALTER TABLE `DispatchRecord` ADD COLUMN `tenantId` VARCHAR(191) NULL;
UPDATE `DispatchRecord` d
  INNER JOIN `ServiceRequest` r ON r.id = d.serviceRequestId
  SET d.tenantId = r.tenantId;
ALTER TABLE `DispatchRecord` MODIFY `tenantId` VARCHAR(191) NOT NULL;
CREATE INDEX `DispatchRecord_tenantId_idx` ON `DispatchRecord`(`tenantId`);
ALTER TABLE `DispatchRecord`
  ADD CONSTRAINT `DispatchRecord_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- SEC-02: OrderItem.tenantId
-- ---------------------------------------------------------------------------
ALTER TABLE `OrderItem` ADD COLUMN `tenantId` VARCHAR(191) NULL;
UPDATE `OrderItem` i
  INNER JOIN `OrderRequest` o ON o.id = i.orderRequestId
  SET i.tenantId = o.tenantId;
ALTER TABLE `OrderItem` MODIFY `tenantId` VARCHAR(191) NOT NULL;
CREATE INDEX `OrderItem_tenantId_idx` ON `OrderItem`(`tenantId`);
ALTER TABLE `OrderItem`
  ADD CONSTRAINT `OrderItem_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- SEC-02: AttachmentBlob / DeviceReprocessingProfile → Tenant FK
-- ---------------------------------------------------------------------------
-- AttachmentBlob.tenantId already exists; add FK if missing orphans were cleaned.
-- Orphan blobs (no matching tenant) are deleted so the FK can be added.
DELETE FROM `AttachmentBlob`
 WHERE `tenantId` NOT IN (SELECT `id` FROM `Tenant`);
ALTER TABLE `AttachmentBlob`
  ADD CONSTRAINT `AttachmentBlob_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

DELETE FROM `DeviceReprocessingProfile`
 WHERE `tenantId` NOT IN (SELECT `id` FROM `Tenant`);
CREATE INDEX `DeviceReprocessingProfile_tenantId_idx` ON `DeviceReprocessingProfile`(`tenantId`);
ALTER TABLE `DeviceReprocessingProfile`
  ADD CONSTRAINT `DeviceReprocessingProfile_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- SCH-01: unique (tenantId, modelId, serialNumber) after neutralizing blank serials
-- ---------------------------------------------------------------------------
UPDATE `DeviceInstance`
  SET `serialNumber` = NULL
 WHERE `serialNumber` IS NOT NULL AND TRIM(`serialNumber`) = '';

-- Collapse duplicates: keep lowest inventoryNumber, blank others' serial
UPDATE `DeviceInstance` d
  INNER JOIN (
    SELECT tenantId, modelId, serialNumber, MIN(inventoryNumber) AS keepInv
    FROM `DeviceInstance`
    WHERE serialNumber IS NOT NULL AND modelId IS NOT NULL
    GROUP BY tenantId, modelId, serialNumber
    HAVING COUNT(*) > 1
  ) dup
    ON dup.tenantId = d.tenantId
   AND dup.modelId = d.modelId
   AND dup.serialNumber = d.serialNumber
   AND d.inventoryNumber <> dup.keepInv
  SET d.serialNumber = NULL;

CREATE UNIQUE INDEX `DeviceInstance_tenantId_modelId_serialNumber_key`
  ON `DeviceInstance`(`tenantId`, `modelId`, `serialNumber`);

-- ---------------------------------------------------------------------------
-- SCH-02: one open classification per model (app-managed unique key)
-- Close older open rows when multiples exist (keep newest validFrom).
-- ---------------------------------------------------------------------------
UPDATE `DeviceModelClassification` c
  INNER JOIN (
    SELECT deviceModelId, MAX(validFrom) AS keepFrom
    FROM `DeviceModelClassification`
    WHERE validTo IS NULL
    GROUP BY deviceModelId
    HAVING COUNT(*) > 1
  ) dup ON dup.deviceModelId = c.deviceModelId
  SET c.validTo = UTC_TIMESTAMP(3)
 WHERE c.validTo IS NULL AND c.validFrom < dup.keepFrom;

ALTER TABLE `DeviceModelClassification`
  ADD COLUMN `openClassificationKey` VARCHAR(191) NULL;
UPDATE `DeviceModelClassification`
  SET `openClassificationKey` = `deviceModelId`
 WHERE `validTo` IS NULL;
CREATE UNIQUE INDEX `DeviceModelClassification_openClassificationKey_key`
  ON `DeviceModelClassification`(`openClassificationKey`);

-- ---------------------------------------------------------------------------
-- OPS-01: DutyReminder
-- ---------------------------------------------------------------------------
CREATE TABLE `DutyReminder` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `deviceDutyId` VARCHAR(191) NOT NULL,
  `stage` VARCHAR(191) NOT NULL,
  `scheduledFor` DATE NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `attemptCount` INT NOT NULL DEFAULT 0,
  `lastError` TEXT NULL,
  `sentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DutyReminder_deviceDutyId_stage_key`(`deviceDutyId`, `stage`),
  INDEX `DutyReminder_tenantId_status_scheduledFor_idx`(`tenantId`, `status`, `scheduledFor`),
  INDEX `DutyReminder_tenantId_deviceDutyId_idx`(`tenantId`, `deviceDutyId`),
  CONSTRAINT `DutyReminder_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `DutyReminder_deviceDutyId_fkey`
    FOREIGN KEY (`deviceDutyId`) REFERENCES `DeviceDuty`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- OPS-02: DispatchOutbox
-- ---------------------------------------------------------------------------
CREATE TABLE `DispatchOutbox` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `serviceRequestId` VARCHAR(191) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `state` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `attemptCount` INT NOT NULL DEFAULT 0,
  `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastError` TEXT NULL,
  `correlationId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DispatchOutbox_serviceRequestId_targetId_key`(`serviceRequestId`, `targetId`),
  INDEX `DispatchOutbox_tenantId_state_nextAttemptAt_idx`(`tenantId`, `state`, `nextAttemptAt`),
  INDEX `DispatchOutbox_nextAttemptAt_state_idx`(`nextAttemptAt`, `state`),
  CONSTRAINT `DispatchOutbox_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `DispatchOutbox_serviceRequestId_fkey`
    FOREIGN KEY (`serviceRequestId`) REFERENCES `ServiceRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `DispatchOutbox_targetId_fkey`
    FOREIGN KEY (`targetId`) REFERENCES `DispatchTarget`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- SEC-06: AuditEvent append-only triggers (single-statement; no BEGIN/END)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `AuditEvent_no_update`;
DROP TRIGGER IF EXISTS `AuditEvent_no_delete`;

CREATE TRIGGER `AuditEvent_no_update`
  BEFORE UPDATE ON `AuditEvent`
  FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AuditEvent is append-only; UPDATE is forbidden';

CREATE TRIGGER `AuditEvent_no_delete`
  BEFORE DELETE ON `AuditEvent`
  FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AuditEvent is append-only; DELETE is forbidden';
