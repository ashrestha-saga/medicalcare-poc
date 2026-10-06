-- Align StatusEvent.state with ServiceRequest.state (add scheduled).
ALTER TABLE `StatusEvent` MODIFY `state` ENUM('captured', 'queued', 'transmitted', 'acknowledged', 'scheduled', 'in_progress', 'completed', 'rejected') NOT NULL;
