-- In-app handoff is distinct from a channel that accepted the payload.
ALTER TABLE `ServiceRequest`
  MODIFY `state` ENUM(
    'captured',
    'queued',
    'transmitted',
    'acknowledged',
    'scheduled',
    'in_progress',
    'completed',
    'rejected',
    'handed_off'
  ) NOT NULL DEFAULT 'captured';

ALTER TABLE `StatusEvent`
  MODIFY `state` ENUM(
    'captured',
    'queued',
    'transmitted',
    'acknowledged',
    'scheduled',
    'in_progress',
    'completed',
    'rejected',
    'handed_off'
  ) NOT NULL;
