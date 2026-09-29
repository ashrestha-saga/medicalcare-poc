-- Append-only audit trail. Actor fields are snapshots (no User FK).

CREATE TABLE `AuditEvent` (
  `id` VARCHAR(191) NOT NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `tenantId` VARCHAR(191) NULL,
  `actorUserId` VARCHAR(191) NULL,
  `actorKind` VARCHAR(191) NOT NULL,
  `actorRole` VARCHAR(191) NULL,
  `actorName` VARCHAR(191) NOT NULL,
  `organisationId` VARCHAR(191) NULL,
  `organisationName` VARCHAR(191) NULL,
  `serviceContractId` VARCHAR(191) NULL,
  `correlationId` VARCHAR(191) NULL,
  `ip` VARCHAR(191) NULL,
  `userAgent` TEXT NULL,
  `resource` VARCHAR(191) NOT NULL,
  `resourceId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `summary` TEXT NOT NULL,
  `before` LONGTEXT NULL,
  `after` LONGTEXT NULL,
  INDEX `AuditEvent_tenantId_occurredAt_idx`(`tenantId`, `occurredAt`),
  INDEX `AuditEvent_tenantId_resource_resourceId_occurredAt_idx`(`tenantId`, `resource`, `resourceId`, `occurredAt`),
  INDEX `AuditEvent_actorUserId_occurredAt_idx`(`actorUserId`, `occurredAt`),
  INDEX `AuditEvent_organisationId_occurredAt_idx`(`organisationId`, `occurredAt`),
  INDEX `AuditEvent_correlationId_idx`(`correlationId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
