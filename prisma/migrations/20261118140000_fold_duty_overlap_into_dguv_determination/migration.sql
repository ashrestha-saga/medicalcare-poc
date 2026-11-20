-- Fold STK↔DGUV DutyOverlapDecision into DeviceDuty.determinationState (E85).
-- Backfill open dguv←stk decisions, then drop the overlap table.
-- AuditEvent is append-only (trigger forbids DELETE); leave historical overlap audits.

-- 1) Open overlaps → covered_by_stk on matching DGUV duties
UPDATE `DeviceDuty` AS d
INNER JOIN `DutyOverlapDecision` AS o
  ON o.`deviceInstanceId` = d.`deviceInstanceId`
 AND o.`coveredDutyKey` = 'dguv'
 AND o.`satisfiedByDutyKey` = 'stk'
 AND o.`validTo` IS NULL
SET
  d.`determinationState` = COALESCE(d.`determinationState`, 'covered_by_stk'),
  d.`determinedAt` = COALESCE(d.`determinedAt`, o.`decidedAt`),
  d.`determinedBy` = COALESCE(d.`determinedBy`, o.`decidedBy`),
  d.`basisText` = CASE
    WHEN d.`basisText` IS NULL OR TRIM(d.`basisText`) = '' THEN o.`reasonText`
    ELSE d.`basisText`
  END,
  d.`applicable` = FALSE,
  d.`suspendedAt` = COALESCE(d.`suspendedAt`, UTC_TIMESTAMP(3)),
  d.`notApplicableReason` = CONCAT('overlap:', o.`reasonText`),
  d.`dueAt` = NULL
WHERE d.`dutyKey` = 'dguv';

-- 2) Drop overlap table
DROP TABLE `DutyOverlapDecision`;
