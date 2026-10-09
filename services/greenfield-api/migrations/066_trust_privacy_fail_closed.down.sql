DROP TABLE IF EXISTS follow_requests;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '065')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
