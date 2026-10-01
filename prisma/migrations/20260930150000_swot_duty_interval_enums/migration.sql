-- SWOT remaining: IntervalUnit + DutyKey enums, narrow TermMatchConfidence, lock validation year_end in docs (app).

-- 1) Normalize DeviceDuty.dutyKey before enum conversion
UPDATE `DeviceDuty` SET `dutyKey` = CASE
  WHEN `dutyKey` LIKE 'val-ref-%' OR `dutyKey` LIKE 'valref-%' OR `dutyKey` = 'validierung-verweis' THEN 'validierung_verweis'
  WHEN `dutyKey` LIKE 'zub-%' OR `dutyKey` = 'zubehoer' THEN 'zubehoer'
  WHEN `dutyKey` LIKE 'konstanz-%' THEN 'konstanz'
  WHEN `dutyKey` IN ('aufb', 'aufbereitung') THEN 'aufbereitung'
  WHEN `dutyKey` IN ('aufb-extern', 'kontrolle') THEN 'kontrolle'
  WHEN `dutyKey` IN ('eigen-val', 'validierung') THEN 'validierung'
  WHEN `dutyKey` IN ('netz', 'vernetzung') THEN 'vernetzung'
  WHEN `dutyKey` IN ('impl', 'implantat') THEN 'implantat'
  WHEN `dutyKey` IN ('einmal', 'einmalprodukt') THEN 'einmalprodukt'
  WHEN `dutyKey` = 'stk-medgv' THEN 'stk'
  ELSE `dutyKey`
END;

-- Drop unknown keys that cannot map (should be none in POC)
UPDATE `DeviceDuty` SET `dutyKey` = 'wartung' WHERE `dutyKey` NOT IN (
  'wartung','stk','mtk','abnahme','konstanz','sv','aerztl','nuklear','itsec','install',
  'aufbereitung','kontrolle','validierung','validierung_verweis','einmalprodukt','zubehoer','vernetzung','implantat'
);

-- 2) IntervalUnit enum on RefInspectionType + DeviceDuty
ALTER TABLE `RefInspectionType` MODIFY `intervalUnit` ENUM('months', 'years') NULL;
ALTER TABLE `DeviceDuty` MODIFY `intervalUnit` ENUM('months', 'years') NULL;

-- 3) DutyKey enum
ALTER TABLE `DeviceDuty` MODIFY `dutyKey` ENUM(
  'wartung','stk','mtk','abnahme','konstanz','sv','aerztl','nuklear','itsec','install',
  'aufbereitung','kontrolle','validierung','validierung_verweis','einmalprodukt','zubehoer','vernetzung','implantat'
) NOT NULL;

-- 4) Narrow termMatchConfidence (map wide Confidence values down)
UPDATE `RefAnnex2Item` SET `termMatchConfidence` = CASE
  WHEN `termMatchConfidence` = 'verified' THEN 'verified'
  ELSE 'derived'
END;

ALTER TABLE `RefAnnex2Item` MODIFY `termMatchConfidence` ENUM('verified', 'derived') NOT NULL DEFAULT 'derived';
