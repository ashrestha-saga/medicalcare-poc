-- Allow arbeitstäglich / working-day constancy takt (QS-RL monitor & digital).
ALTER TABLE `RefInspectionType` MODIFY `intervalUnit` ENUM('months', 'years', 'working_days') NULL;
ALTER TABLE `DeviceDuty` MODIFY `intervalUnit` ENUM('months', 'years', 'working_days') NULL;
ALTER TABLE `ConstancyCadence` MODIFY `intervalUnit` ENUM('months', 'years', 'working_days') NOT NULL;
