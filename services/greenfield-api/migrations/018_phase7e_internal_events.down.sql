DROP TABLE IF EXISTS greenfield_event_deliveries;
DROP TABLE IF EXISTS greenfield_event_subscriptions;
DROP TABLE IF EXISTS greenfield_domain_events;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','017') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
