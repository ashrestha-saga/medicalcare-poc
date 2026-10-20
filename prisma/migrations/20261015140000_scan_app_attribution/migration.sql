-- Scan-App attribution + evidence FKs (E2 signature, check performer, process-record blob, book photo).

ALTER TABLE `AttachmentBlob` ADD COLUMN `sha256` VARCHAR(64) NULL;
CREATE INDEX `AttachmentBlob_tenantId_sha256_idx` ON `AttachmentBlob`(`tenantId`, `sha256`);

ALTER TABLE `DeviceBookEntry` ADD COLUMN `attachmentBlobId` VARCHAR(191) NULL;
CREATE INDEX `DeviceBookEntry_attachmentBlobId_idx` ON `DeviceBookEntry`(`attachmentBlobId`);
ALTER TABLE `DeviceBookEntry` ADD CONSTRAINT `DeviceBookEntry_attachmentBlobId_fkey` FOREIGN KEY (`attachmentBlobId`) REFERENCES `AttachmentBlob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ReprocessingCheck` ADD COLUMN `performedById` VARCHAR(191) NULL;
CREATE INDEX `ReprocessingCheck_performedById_idx` ON `ReprocessingCheck`(`performedById`);
ALTER TABLE `ReprocessingCheck` ADD CONSTRAINT `ReprocessingCheck_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ReprocessingBatch` ADD COLUMN `processRecordBlobId` VARCHAR(191) NULL;
ALTER TABLE `ReprocessingBatch` ADD COLUMN `releasedById` VARCHAR(191) NULL;
CREATE INDEX `ReprocessingBatch_processRecordBlobId_idx` ON `ReprocessingBatch`(`processRecordBlobId`);
CREATE INDEX `ReprocessingBatch_releasedById_idx` ON `ReprocessingBatch`(`releasedById`);
ALTER TABLE `ReprocessingBatch` ADD CONSTRAINT `ReprocessingBatch_processRecordBlobId_fkey` FOREIGN KEY (`processRecordBlobId`) REFERENCES `AttachmentBlob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ReprocessingBatch` ADD CONSTRAINT `ReprocessingBatch_releasedById_fkey` FOREIGN KEY (`releasedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
