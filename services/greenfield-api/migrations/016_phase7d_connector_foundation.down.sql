DROP TABLE IF EXISTS greenfield_connection_events;
DROP TABLE IF EXISTS greenfield_connection_sync_state;
DROP TABLE IF EXISTS greenfield_connection_permissions;
DROP TABLE IF EXISTS greenfield_connection_scopes;
DROP TABLE IF EXISTS greenfield_connection_credentials;
DROP TABLE IF EXISTS greenfield_connections;
DROP TABLE IF EXISTS greenfield_connector_providers;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','015') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
