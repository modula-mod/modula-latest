DROP TABLE IF EXISTS greenfield_mail_jobs;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '028')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
