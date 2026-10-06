-- Staff module: deployment area on OrgMembership + skills/qualifications catalogue.

CREATE TABLE `RefQualification` (
    `code` VARCHAR(191) NOT NULL,
    `label` TEXT NOT NULL,
    `legalBasis` VARCHAR(191) NULL,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RefSkill` (
    `code` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RefSkillLevel` (
    `code` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `rank` INTEGER NOT NULL,

    UNIQUE INDEX `RefSkillLevel_rank_key`(`rank`),
    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PersonQualification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `qualificationCode` VARCHAR(191) NOT NULL,
    `validUntil` DATE NULL,
    `evidenceRef` VARCHAR(191) NULL,
    `recordedBy` VARCHAR(191) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PersonQualification_validUntil_idx`(`validUntil`),
    UNIQUE INDEX `PersonQualification_userId_qualificationCode_key`(`userId`, `qualificationCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PersonSkill` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `skillCode` VARCHAR(191) NOT NULL,
    `levelCode` VARCHAR(191) NOT NULL,
    `validUntil` DATE NULL,
    `evidenceRef` VARCHAR(191) NULL,
    `recordedBy` VARCHAR(191) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PersonSkill_validUntil_idx`(`validUntil`),
    UNIQUE INDEX `PersonSkill_userId_skillCode_key`(`userId`, `skillCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OrgMembership` ADD COLUMN `dispatchOrigin` ENUM('home', 'organisation') NOT NULL DEFAULT 'organisation';
ALTER TABLE `OrgMembership` ADD COLUMN `originPostalCode` VARCHAR(191) NULL;
ALTER TABLE `OrgMembership` ADD COLUMN `originCity` VARCHAR(191) NULL;
ALTER TABLE `OrgMembership` ADD COLUMN `radiusKm` INTEGER NULL;

ALTER TABLE `PersonQualification` ADD CONSTRAINT `PersonQualification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PersonQualification` ADD CONSTRAINT `PersonQualification_qualificationCode_fkey` FOREIGN KEY (`qualificationCode`) REFERENCES `RefQualification`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PersonSkill` ADD CONSTRAINT `PersonSkill_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PersonSkill` ADD CONSTRAINT `PersonSkill_skillCode_fkey` FOREIGN KEY (`skillCode`) REFERENCES `RefSkill`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PersonSkill` ADD CONSTRAINT `PersonSkill_levelCode_fkey` FOREIGN KEY (`levelCode`) REFERENCES `RefSkillLevel`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;
