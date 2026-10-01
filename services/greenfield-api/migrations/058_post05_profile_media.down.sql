DROP TABLE IF EXISTS profile_media;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '057')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
