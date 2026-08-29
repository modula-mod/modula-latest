DROP TRIGGER IF EXISTS greenfield_release_frontends_immutable ON greenfield_release_frontends;
DROP FUNCTION IF EXISTS greenfield_reject_release_frontend_update();
DROP TABLE IF EXISTS greenfield_release_frontends;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '054')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
