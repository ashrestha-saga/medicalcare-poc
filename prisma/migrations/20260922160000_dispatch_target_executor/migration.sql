-- DispatchTarget owned by ExecutorOrg (mail/API per partner).
ALTER TABLE `DispatchTarget`
  ADD COLUMN `executorOrgId` VARCHAR(191) NULL;

CREATE INDEX `DispatchTarget_executorOrgId_enabled_idx`
  ON `DispatchTarget`(`executorOrgId`, `enabled`);

ALTER TABLE `DispatchTarget`
  ADD CONSTRAINT `DispatchTarget_executorOrgId_fkey`
  FOREIGN KEY (`executorOrgId`) REFERENCES `ExecutorOrg`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
