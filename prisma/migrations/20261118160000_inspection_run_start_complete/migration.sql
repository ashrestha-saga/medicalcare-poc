-- Inspection protocol wall-clock start / completion (beside performedAt date).
ALTER TABLE `InspectionRun`
  ADD COLUMN `startedAt` DATETIME(3) NULL,
  ADD COLUMN `completedAt` DATETIME(3) NULL;

-- Best-effort backfill for already sealed / completed protocols.
UPDATE `InspectionRun` r
LEFT JOIN `MaintenanceEvent` me ON me.`inspectionRunId` = r.`id`
SET
  r.`completedAt` = COALESCE(me.`performedAt`, TIMESTAMP(r.`performedAt`)),
  r.`startedAt` = COALESCE(me.`performedAt`, TIMESTAMP(r.`performedAt`))
WHERE r.`dutyPerformanceId` IS NOT NULL
   OR me.`id` IS NOT NULL;
