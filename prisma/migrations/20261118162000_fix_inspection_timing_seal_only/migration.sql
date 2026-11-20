-- Start = "Inspection started" / Start now; Finish = "Protocol sealed" only (never quote events).

UPDATE `InspectionRun` r
INNER JOIN (
  SELECT `serviceRequestId`, MIN(`changedAt`) AS `sealedAt`
  FROM `StatusEvent`
  WHERE `note` LIKE 'Protocol sealed%' OR `note` LIKE 'Sammelauftrag item sealed%'
  GROUP BY `serviceRequestId`
) se_seal ON se_seal.`serviceRequestId` = r.`serviceRequestId`
LEFT JOIN (
  SELECT `serviceRequestId`, MIN(`changedAt`) AS `startedAt`
  FROM `StatusEvent`
  WHERE `note` LIKE 'Inspection started%'
     OR (`source` = 'inspection_run' AND `state` = 'in_progress')
  GROUP BY `serviceRequestId`
) se_start ON se_start.`serviceRequestId` = r.`serviceRequestId`
SET
  r.`completedAt` = se_seal.`sealedAt`,
  r.`startedAt` = COALESCE(se_start.`startedAt`, r.`startedAt`);

-- Any finish still equal to a Quote status event → replace with seal / maintenance time.
UPDATE `InspectionRun` r
INNER JOIN `StatusEvent` q
  ON q.`serviceRequestId` = r.`serviceRequestId`
 AND q.`state` = 'completed'
 AND (q.`note` LIKE 'Quote %')
 AND q.`changedAt` = r.`completedAt`
LEFT JOIN (
  SELECT `serviceRequestId`, MIN(`changedAt`) AS `sealedAt`
  FROM `StatusEvent`
  WHERE `note` LIKE 'Protocol sealed%' OR `note` LIKE 'Sammelauftrag item sealed%'
  GROUP BY `serviceRequestId`
) se_seal ON se_seal.`serviceRequestId` = r.`serviceRequestId`
LEFT JOIN `MaintenanceEvent` me ON me.`inspectionRunId` = r.`id`
SET r.`completedAt` = COALESCE(se_seal.`sealedAt`, me.`performedAt`);
