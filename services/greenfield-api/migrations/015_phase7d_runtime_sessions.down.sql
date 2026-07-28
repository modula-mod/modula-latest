DROP TABLE IF EXISTS greenfield_runtime_session_events;
DROP TABLE IF EXISTS greenfield_runtime_sessions;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','014') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
