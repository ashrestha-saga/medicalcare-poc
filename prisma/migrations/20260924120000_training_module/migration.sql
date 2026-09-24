-- Training module: event + per-person records (ops.training_*).
-- person_id maps to clinic User (staff subject), not partner accounts.

CREATE TABLE `TrainingEvent` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `trainingTypeCode` VARCHAR(191) NOT NULL,
  `subjectModelId` VARCHAR(191) NULL,
  `subjectActivity` VARCHAR(191) NULL,
  `heldOn` DATE NOT NULL,
  `location` VARCHAR(191) NULL,
  `instructorName` VARCHAR(191) NOT NULL,
  `instructorQualification` VARCHAR(191) NOT NULL,
  `instructorExternal` BOOLEAN NOT NULL DEFAULT false,
  `basisDocument` VARCHAR(191) NOT NULL,
  `mode` VARCHAR(191) NOT NULL,
  `recordedBy` VARCHAR(191) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `TrainingEvent_tenantId_heldOn_idx`(`tenantId`, `heldOn`),
  INDEX `TrainingEvent_trainingTypeCode_idx`(`trainingTypeCode`),
  INDEX `TrainingEvent_subjectModelId_idx`(`subjectModelId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TrainingRecord` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `personId` VARCHAR(191) NOT NULL,
  `confirmedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `validUntil` DATE NULL,
  UNIQUE INDEX `TrainingRecord_eventId_personId_key`(`eventId`, `personId`),
  INDEX `TrainingRecord_tenantId_idx`(`tenantId`),
  INDEX `TrainingRecord_personId_validUntil_idx`(`personId`, `validUntil`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TrainingEvent` ADD CONSTRAINT `TrainingEvent_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `TrainingEvent` ADD CONSTRAINT `TrainingEvent_trainingTypeCode_fkey`
  FOREIGN KEY (`trainingTypeCode`) REFERENCES `RefTrainingType`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `TrainingEvent` ADD CONSTRAINT `TrainingEvent_subjectModelId_fkey`
  FOREIGN KEY (`subjectModelId`) REFERENCES `DeviceModel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `TrainingRecord` ADD CONSTRAINT `TrainingRecord_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `TrainingRecord` ADD CONSTRAINT `TrainingRecord_eventId_fkey`
  FOREIGN KEY (`eventId`) REFERENCES `TrainingEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TrainingRecord` ADD CONSTRAINT `TrainingRecord_personId_fkey`
  FOREIGN KEY (`personId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
