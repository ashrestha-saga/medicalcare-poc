-- FieldSafetyAffectedModel: structured recall scope for candidate suggestion.

CREATE TABLE `FieldSafetyAffectedModel` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `fieldSafetyActionId` VARCHAR(191) NOT NULL,
    `deviceModelId` VARCHAR(191) NULL,
    `basicUdiDi` VARCHAR(191) NULL,
    `serialFrom` VARCHAR(191) NULL,
    `serialTo` VARCHAR(191) NULL,
    `lotNumber` VARCHAR(191) NULL,
    `note` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `FieldSafetyAffectedModel_fieldSafetyActionId_idx` ON `FieldSafetyAffectedModel`(`fieldSafetyActionId`);
CREATE INDEX `FieldSafetyAffectedModel_tenantId_idx` ON `FieldSafetyAffectedModel`(`tenantId`);
CREATE INDEX `FieldSafetyAffectedModel_deviceModelId_idx` ON `FieldSafetyAffectedModel`(`deviceModelId`);

ALTER TABLE `FieldSafetyAffectedModel` ADD CONSTRAINT `FieldSafetyAffectedModel_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `FieldSafetyAffectedModel` ADD CONSTRAINT `FieldSafetyAffectedModel_fieldSafetyActionId_fkey` FOREIGN KEY (`fieldSafetyActionId`) REFERENCES `FieldSafetyAction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `FieldSafetyAffectedModel` ADD CONSTRAINT `FieldSafetyAffectedModel_deviceModelId_fkey` FOREIGN KEY (`deviceModelId`) REFERENCES `DeviceModel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
