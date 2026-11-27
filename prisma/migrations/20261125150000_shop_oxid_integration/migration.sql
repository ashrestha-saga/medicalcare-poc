-- Shop OXID integration: rename connection, order lifecycle, OAuth state.

-- Enums
CREATE TABLE `OrderPurpose` (
    `id` ENUM('device', 'parts') NOT NULL,
    PRIMARY KEY (`id`)
);
-- Prisma MySQL enums are inline; use ALTER style below instead of separate tables.
DROP TABLE IF EXISTS `OrderPurpose`;

ALTER TABLE `TenantOxidConnection` RENAME TO `TenantShopConnection`;

ALTER TABLE `TenantShopConnection`
    ADD COLUMN `provider` ENUM('oxid', 'mock') NOT NULL DEFAULT 'oxid',
    ADD COLUMN `clientId` VARCHAR(191) NULL,
    ADD COLUMN `clientSecretEnc` TEXT NULL,
    ADD COLUMN `scope` TEXT NULL,
    ADD COLUMN `configJson` TEXT NULL,
    ADD COLUMN `deliveryMapJson` TEXT NULL,
    ADD COLUMN `hasSubUsers` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `submitLeaseUntil` DATETIME(3) NULL,
    ADD COLUMN `submitLeaseBy` VARCHAR(191) NULL;

CREATE TABLE `ShopOAuthState` (
    `id` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `codeVerifier` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `adminUserId` VARCHAR(191) NOT NULL,
    `returnTo` VARCHAR(191) NOT NULL DEFAULT '/settings',
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `ShopOAuthState_state_key`(`state`),
    INDEX `ShopOAuthState_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ShopOAuthState`
    ADD CONSTRAINT `ShopOAuthState_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OrderRequest`
    ADD COLUMN `shopConnectionId` VARCHAR(191) NULL,
    ADD COLUMN `purpose` ENUM('device', 'parts') NOT NULL DEFAULT 'parts',
    ADD COLUMN `deviceInstanceId` VARCHAR(191) NULL,
    ADD COLUMN `serviceRequestId` VARCHAR(191) NULL,
    ADD COLUMN `deliverySiteId` VARCHAR(191) NULL,
    ADD COLUMN `externalState` ENUM('intent', 'submitting', 'ordered', 'shipped', 'cancelled', 'failed', 'expired') NOT NULL DEFAULT 'intent',
    ADD COLUMN `externalOrderRef` VARCHAR(191) NULL,
    ADD COLUMN `externalOrderId` VARCHAR(191) NULL,
    ADD COLUMN `submitKey` VARCHAR(191) NULL,
    ADD COLUMN `orderedByName` VARCHAR(191) NULL,
    ADD COLUMN `netTotalFromSource` DECIMAL(12, 2) NULL,
    ADD COLUMN `currency` VARCHAR(191) NULL DEFAULT 'EUR',
    ADD COLUMN `lastSubmitError` TEXT NULL,
    ADD COLUMN `triggeredVia` VARCHAR(191) NOT NULL DEFAULT 'devicecare';

CREATE INDEX `OrderRequest_tenantId_externalState_idx` ON `OrderRequest`(`tenantId`, `externalState`);
CREATE INDEX `OrderRequest_shopConnectionId_idx` ON `OrderRequest`(`shopConnectionId`);
CREATE INDEX `OrderRequest_deviceInstanceId_idx` ON `OrderRequest`(`deviceInstanceId`);

ALTER TABLE `OrderRequest`
    ADD CONSTRAINT `OrderRequest_shopConnectionId_fkey`
    FOREIGN KEY (`shopConnectionId`) REFERENCES `TenantShopConnection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `OrderItem`
    ADD COLUMN `shopArticleId` VARCHAR(191) NULL,
    ADD COLUMN `gtin` VARCHAR(191) NULL,
    ADD COLUMN `priceSource` VARCHAR(191) NOT NULL DEFAULT 'none',
    ADD COLUMN `quantityConfirmed` INTEGER NULL;

CREATE TABLE `OrderStatusEvent` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `orderRequestId` VARCHAR(191) NOT NULL,
    `externalState` ENUM('intent', 'submitting', 'ordered', 'shipped', 'cancelled', 'failed', 'expired') NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `actorName` VARCHAR(191) NULL,
    `invoiceRef` VARCHAR(191) NULL,
    `netTotal` DECIMAL(12, 2) NULL,
    `shippedLinesJson` TEXT NULL,
    `payloadHash` VARCHAR(191) NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `OrderStatusEvent_orderRequestId_eventId_key`(`orderRequestId`, `eventId`),
    INDEX `OrderStatusEvent_tenantId_receivedAt_idx`(`tenantId`, `receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OrderStatusEvent`
    ADD CONSTRAINT `OrderStatusEvent_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `OrderStatusEvent`
    ADD CONSTRAINT `OrderStatusEvent_orderRequestId_fkey`
    FOREIGN KEY (`orderRequestId`) REFERENCES `OrderRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
