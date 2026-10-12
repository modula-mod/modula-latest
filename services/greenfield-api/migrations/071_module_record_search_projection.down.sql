DELETE FROM greenfield_event_subscriptions
WHERE event_type = 'module.record.changed'
  AND subscriber_id = 'search.module-record-projector';

DELETE FROM greenfield_event_schema_registry
WHERE event_type = 'module.record.changed'
  AND event_version = '1.0.0';

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '070')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
