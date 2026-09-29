-- AlterTable: add kind for RoleGrant (clinic vs partner grants)
ALTER TABLE `RoleGrant` ADD COLUMN `kind` VARCHAR(32) NOT NULL DEFAULT 'clinic';

-- DropIndex
DROP INDEX `RoleGrant_role_permission_key` ON `RoleGrant`;

-- DropIndex
DROP INDEX `RoleGrant_role_idx` ON `RoleGrant`;

-- Existing rows keep kind=clinic (DEFAULT). Create new unique + index.
CREATE UNIQUE INDEX `RoleGrant_kind_role_permission_key` ON `RoleGrant`(`kind`, `role`, `permission`);
CREATE INDEX `RoleGrant_kind_role_idx` ON `RoleGrant`(`kind`, `role`);
