-- Appointment becomes date+time (was date-only).
ALTER TABLE `ServiceRequest` MODIFY `scheduledAt` DATETIME(3) NULL;
