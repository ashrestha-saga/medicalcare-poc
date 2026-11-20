-- Nachtrag 4 / RD18–RD26 — Strahlenschutz, DGUV, Betriebsmittel, gates, Sammelauftrag
-- Additive only; existing rows default to kind=mp / captureMode=device_protocol.

-- Enum extensions
ALTER TABLE `DeviceInstance`
    MODIFY COLUMN `lockSource` ENUM('inspection', 'mpsb', 'user', 'recall', 'rso') NULL;

ALTER TABLE `ServiceRequest`
    MODIFY COLUMN `fulfilment` ENUM('on_site', 'send_in', 'external') NOT NULL DEFAULT 'on_site';

ALTER TABLE `DutyPerformance`
    MODIFY COLUMN `result` ENUM('passed', 'passed_with_conditions', 'failed', 'deviation') NOT NULL DEFAULT 'passed';

ALTER TABLE `InspectionRun`
    MODIFY COLUMN `result` ENUM('passed', 'passed_with_conditions', 'failed', 'deviation') NOT NULL DEFAULT 'passed';

-- RD18 — DeviceInstance equipment fields
ALTER TABLE `DeviceInstance`
    ADD COLUMN `kind` ENUM('mp', 'equipment') NOT NULL DEFAULT 'mp',
    ADD COLUMN `protectionClass` ENUM('I', 'II', 'III') NULL,
    ADD COLUMN `portable` BOOLEAN NULL,
    ADD COLUMN `electrical` BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX `DeviceInstance_tenantId_kind_idx` ON `DeviceInstance`(`tenantId`, `kind`);

-- RD19 — DGUV determination on DeviceDuty
ALTER TABLE `DeviceDuty`
    ADD COLUMN `determinedBy` VARCHAR(191) NULL,
    ADD COLUMN `determinedByUserId` VARCHAR(191) NULL,
    ADD COLUMN `determinedAt` DATE NULL,
    ADD COLUMN `determinationState` VARCHAR(191) NULL;

CREATE INDEX `DeviceDuty_tenantId_dutyKey_determinationState_idx` ON `DeviceDuty`(`tenantId`, `dutyKey`, `determinationState`);

-- RD20 — requiresLabel + performance label / measurements
ALTER TABLE `RefInspectionType`
    ADD COLUMN `requiresLabel` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `DutyPerformance`
    ADD COLUMN `labelNumber` VARCHAR(191) NULL,
    ADD COLUMN `labelNextDue` DATE NULL,
    ADD COLUMN `measurementsJson` JSON NULL,
    ADD COLUMN `captureMode` ENUM('device_protocol', 'manual_measurement', 'visual') NULL,
    ADD COLUMN `attachmentBlobId` VARCHAR(191) NULL,
    ADD COLUMN `clarificationId` VARCHAR(191) NULL,
    ADD COLUMN `retentionUntil` DATE NULL;

CREATE INDEX `DutyPerformance_tenantId_retentionUntil_idx` ON `DutyPerformance`(`tenantId`, `retentionUntil`);
CREATE INDEX `DutyPerformance_attachmentBlobId_idx` ON `DutyPerformance`(`attachmentBlobId`);
CREATE INDEX `DutyPerformance_clarificationId_idx` ON `DutyPerformance`(`clarificationId`);

ALTER TABLE `DutyPerformance`
    ADD CONSTRAINT `DutyPerformance_attachmentBlobId_fkey`
        FOREIGN KEY (`attachmentBlobId`) REFERENCES `AttachmentBlob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `DutyPerformance_clarificationId_fkey`
        FOREIGN KEY (`clarificationId`) REFERENCES `DeviceClarification`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RD21 — ConstancyCadence capture mode + refs
ALTER TABLE `ConstancyCadence`
    ADD COLUMN `captureMode` ENUM('device_protocol', 'manual_measurement', 'visual') NOT NULL DEFAULT 'device_protocol',
    ADD COLUMN `protocolSource` VARCHAR(191) NULL,
    ADD COLUMN `referenceValuesJson` JSON NULL;

-- RD22b — InspectionRun capture mode
ALTER TABLE `InspectionRun`
    ADD COLUMN `captureMode` ENUM('device_protocol', 'manual_measurement', 'visual') NULL,
    ADD COLUMN `protocolBlobId` VARCHAR(191) NULL;

-- RD24 / RD25 — ServiceRequest gateKind + external SV fields
ALTER TABLE `ServiceRequest`
    ADD COLUMN `gateKind` VARCHAR(191) NULL,
    ADD COLUMN `externalOrgName` VARCHAR(191) NULL,
    ADD COLUMN `externalCommissionedAt` DATE NULL,
    ADD COLUMN `externalCertificateRef` VARCHAR(191) NULL,
    ADD COLUMN `externalCertificateDate` DATE NULL,
    ADD COLUMN `externalCertificateBlobId` VARCHAR(191) NULL,
    ADD COLUMN `externalResult` VARCHAR(191) NULL,
    ADD COLUMN `externalDefectsText` TEXT NULL;

CREATE INDEX `ServiceRequest_externalCertificateBlobId_idx` ON `ServiceRequest`(`externalCertificateBlobId`);
ALTER TABLE `ServiceRequest`
    ADD CONSTRAINT `ServiceRequest_externalCertificateBlobId_fkey`
        FOREIGN KEY (`externalCertificateBlobId`) REFERENCES `AttachmentBlob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RD24 — ServiceTypeGate
CREATE TABLE `ServiceTypeGate` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `serviceType` VARCHAR(191) NOT NULL,
    `qualificationCode` VARCHAR(191) NOT NULL,
    `gate` VARCHAR(191) NOT NULL DEFAULT 'block',
    `overridableBy` ENUM('none', 'service_lead', 'management') NOT NULL DEFAULT 'none',
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `setBy` VARCHAR(191) NOT NULL,
    `setAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ServiceTypeGate_organisationId_serviceType_key`(`organisationId`, `serviceType`),
    INDEX `ServiceTypeGate_qualificationCode_idx`(`qualificationCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ServiceTypeGate`
    ADD CONSTRAINT `ServiceTypeGate_organisationId_fkey`
        FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `ServiceTypeGate_qualificationCode_fkey`
        FOREIGN KEY (`qualificationCode`) REFERENCES `RefQualification`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RD26 — ServiceRequestItem + visit institution signature
CREATE TABLE `ServiceRequestItem` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `serviceRequestId` VARCHAR(191) NOT NULL,
    `deviceInstanceId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'open',
    `inspectionRunId` VARCHAR(191) NULL,
    `skippedReason` TEXT NULL,

    UNIQUE INDEX `ServiceRequestItem_serviceRequestId_deviceInstanceId_key`(`serviceRequestId`, `deviceInstanceId`),
    UNIQUE INDEX `ServiceRequestItem_inspectionRunId_key`(`inspectionRunId`),
    INDEX `ServiceRequestItem_tenantId_serviceRequestId_idx`(`tenantId`, `serviceRequestId`),
    INDEX `ServiceRequestItem_deviceInstanceId_idx`(`deviceInstanceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ServiceRequestItem`
    ADD CONSTRAINT `ServiceRequestItem_tenantId_fkey`
        FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `ServiceRequestItem_serviceRequestId_fkey`
        FOREIGN KEY (`serviceRequestId`) REFERENCES `ServiceRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `ServiceRequestItem_deviceInstanceId_fkey`
        FOREIGN KEY (`deviceInstanceId`) REFERENCES `DeviceInstance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `ServiceRequestItem_inspectionRunId_fkey`
        FOREIGN KEY (`inspectionRunId`) REFERENCES `InspectionRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ServiceVisit`
    ADD COLUMN `institutionSignerName` VARCHAR(191) NULL,
    ADD COLUMN `institutionSignerRole` VARCHAR(191) NULL,
    ADD COLUMN `institutionSignatureBlobId` VARCHAR(191) NULL,
    ADD COLUMN `institutionSignedAt` DATETIME(3) NULL;

CREATE INDEX `ServiceVisit_institutionSignatureBlobId_idx` ON `ServiceVisit`(`institutionSignatureBlobId`);
ALTER TABLE `ServiceVisit`
    ADD CONSTRAINT `ServiceVisit_institutionSignatureBlobId_fkey`
        FOREIGN KEY (`institutionSignatureBlobId`) REFERENCES `AttachmentBlob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
