-- Phase B: editable role → permission grants (global).

CREATE TABLE `RoleGrant` (
    `id` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `permission` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `RoleGrant_role_permission_key` ON `RoleGrant`(`role`, `permission`);
CREATE INDEX `RoleGrant_role_idx` ON `RoleGrant`(`role`);
