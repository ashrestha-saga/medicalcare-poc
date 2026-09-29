-- AlterTable
ALTER TABLE `DeviceInstance` MODIFY `state` ENUM('draft', 'review', 'released', 'retired') NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE `DeviceModel` MODIFY `state` ENUM('draft', 'review', 'released', 'retired') NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE `DispatchOutbox` MODIFY `state` ENUM('pending', 'processing', 'delivered', 'dead') NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE `DutyReminder` MODIFY `status` ENUM('pending', 'sent', 'failed', 'skipped') NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE `OrgMembership` MODIFY `appRole` ENUM('inspector', 'admin', 'order') NOT NULL;

-- AlterTable
ALTER TABLE `ServiceRequest` MODIFY `state` ENUM('captured', 'queued', 'transmitted', 'acknowledged', 'in_progress', 'completed', 'rejected') NOT NULL DEFAULT 'captured';

-- AlterTable
ALTER TABLE `StatusEvent` MODIFY `state` ENUM('captured', 'queued', 'transmitted', 'acknowledged', 'in_progress', 'completed', 'rejected') NOT NULL;

-- AlterTable
ALTER TABLE `Tenant` MODIFY `operatingModel` ENUM('provider_operated', 'institution_operated') NOT NULL DEFAULT 'institution_operated';

-- AlterTable
ALTER TABLE `TrainingEvent` MODIFY `mode` ENUM('individual', 'group') NOT NULL;

