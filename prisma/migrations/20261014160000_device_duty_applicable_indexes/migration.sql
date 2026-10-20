-- Align DeviceDuty indexes with dashboard / due-dates filters
-- (tenantId + applicable + suspendedAt + dueAt), and dutyKey-scoped tiles.

DROP INDEX `DeviceDuty_tenantId_suspendedAt_dueAt_idx` ON `DeviceDuty`;

CREATE INDEX `DeviceDuty_tenantId_applicable_suspendedAt_dueAt_idx` ON `DeviceDuty`(`tenantId`, `applicable`, `suspendedAt`, `dueAt`);

CREATE INDEX `DeviceDuty_tenantId_dutyKey_applicable_suspendedAt_idx` ON `DeviceDuty`(`tenantId`, `dutyKey`, `applicable`, `suspendedAt`);
