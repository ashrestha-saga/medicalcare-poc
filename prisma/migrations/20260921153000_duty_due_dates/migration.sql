-- Per-duty due dates, completion, and reminder placeholders (cron later).

ALTER TABLE `DeviceDuty`
    ADD COLUMN `dueAt` DATE NULL,
    ADD COLUMN `lastCompletedAt` DATETIME(3) NULL,
    ADD COLUMN `lastNotifiedAt` DATETIME(3) NULL,
    ADD COLUMN `notifyStage` VARCHAR(191) NULL;

CREATE INDEX `DeviceDuty_tenantId_suspendedAt_dueAt_idx` ON `DeviceDuty`(`tenantId`, `suspendedAt`, `dueAt`);
