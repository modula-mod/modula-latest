DROP TABLE IF EXISTS greenfield_support_cases;
DROP TABLE IF EXISTS greenfield_worker_heartbeats;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '061')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
