-- SWOT v2: at most one open ReprocessingOnDevice row per product↔equipment pair.
ALTER TABLE `ReprocessingOnDevice` ADD COLUMN `openLinkKey` VARCHAR(191) NULL;

UPDATE `ReprocessingOnDevice`
SET `openLinkKey` = CONCAT(`profileDeviceId`, ':', `equipmentDeviceId`)
WHERE `validTo` IS NULL;

CREATE UNIQUE INDEX `ReprocessingOnDevice_openLinkKey_key` ON `ReprocessingOnDevice`(`openLinkKey`);
