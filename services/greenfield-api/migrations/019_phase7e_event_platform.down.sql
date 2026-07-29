DROP TABLE IF EXISTS greenfield_event_replay_requests;
DROP TABLE IF EXISTS greenfield_event_inbox;
DROP TABLE IF EXISTS greenfield_event_schema_registry;

DROP INDEX IF EXISTS greenfield_event_deliveries_dead_letter_idx;

ALTER TABLE greenfield_event_deliveries
  DROP CONSTRAINT IF EXISTS greenfield_event_deliveries_status_check;

UPDATE greenfield_event_deliveries
SET status = CASE status
  WHEN 'completed' THEN 'delivered'
  WHEN 'retrying' THEN 'failed'
  WHEN 'dead_lettered' THEN 'dead_letter'
  ELSE status
END;

ALTER TABLE greenfield_event_deliveries
  ADD CONSTRAINT greenfield_event_deliveries_status_check
  CHECK (status IN ('pending','leased','delivered','failed','dead_letter','cancelled'));

ALTER TABLE greenfield_event_subscriptions
  DROP COLUMN IF EXISTS max_concurrency,
  DROP COLUMN IF EXISTS subscriber_timeout_ms,
  DROP COLUMN IF EXISTS permitted_classifications,
  DROP COLUMN IF EXISTS permitted_visibility;

DROP INDEX IF EXISTS greenfield_domain_events_classification_idx;

ALTER TABLE greenfield_domain_events
  ALTER COLUMN request_id DROP NOT NULL,
  ALTER COLUMN correlation_id DROP NOT NULL,
  DROP COLUMN IF EXISTS classification,
  DROP COLUMN IF EXISTS visibility,
  DROP COLUMN IF EXISTS aggregate_version;

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','018') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
