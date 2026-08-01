DROP TABLE IF EXISTS module_backend_failures;
DROP TABLE IF EXISTS module_backend_webhook_deliveries;
DROP TABLE IF EXISTS module_backend_event_deliveries;
DROP TABLE IF EXISTS module_backend_event_subscriptions;
DROP TABLE IF EXISTS module_backend_capabilities;
DROP TABLE IF EXISTS module_backend_health;
DROP TABLE IF EXISTS module_backend_sessions;
DROP TABLE IF EXISTS module_backend_installations;
DROP TABLE IF EXISTS module_backend_definitions;

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','022') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
