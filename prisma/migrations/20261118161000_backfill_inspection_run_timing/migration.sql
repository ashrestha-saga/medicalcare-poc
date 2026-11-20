-- Backfill wall-clock start/finish for completed protocols.
-- Start = Inspection started (Start now); Finish = Protocol sealed only (never quote status events).

UPDATE `InspectionRun` r
INNER JOIN `ServiceRequest` sr ON sr.`id` = r.`serviceRequestId` AND sr.`state` = 'completed'
LEFT JOIN `MaintenanceEvent` me ON me.`inspectionRunId` = r.`id`
LEFT JOIN (
  SELECT `serviceRequestId`, MIN(`changedAt`) AS `startedAt`
  FROM `StatusEvent`
  WHERE `note` LIKE 'Inspection started%'
     OR (`source` = 'inspection_run' AND `state` = 'in_progress')
  GROUP BY `serviceRequestId`
) se_start ON se_start.`serviceRequestId` = r.`serviceRequestId`
LEFT JOIN (
  SELECT `serviceRequestId`, MIN(`changedAt`) AS `sealedAt`
  FROM `StatusEvent`
  WHERE `note` LIKE 'Protocol sealed%' OR `note` LIKE 'Sammelauftrag item sealed%'
  GROUP BY `serviceRequestId`
) se_seal ON se_seal.`serviceRequestId` = r.`serviceRequestId`
SET
  r.`startedAt` = COALESCE(r.`startedAt`, se_start.`startedAt`, TIMESTAMP(r.`performedAt`)),
  r.`completedAt` = COALESCE(r.`completedAt`, se_seal.`sealedAt`, me.`performedAt`, TIMESTAMP(r.`performedAt`))
WHERE r.`startedAt` IS NULL OR r.`completedAt` IS NULL;
