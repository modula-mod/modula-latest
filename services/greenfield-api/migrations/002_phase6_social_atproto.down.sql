-- Rollback Phase 6 social / worker / AT Protocol tables

DROP TABLE IF EXISTS atproto_dead_letters CASCADE;
DROP TABLE IF EXISTS atproto_sync_checkpoints CASCADE;
DROP TABLE IF EXISTS atproto_records CASCADE;
DROP TABLE IF EXISTS atproto_publications CASCADE;
DROP TABLE IF EXISTS atproto_publication_preferences CASCADE;
DROP TABLE IF EXISTS atproto_oauth_sessions CASCADE;
DROP TABLE IF EXISTS atproto_oauth_states CASCADE;
DROP TABLE IF EXISTS atproto_connections CASCADE;
DROP TABLE IF EXISTS job_failures CASCADE;
DROP TABLE IF EXISTS background_jobs CASCADE;
DROP TABLE IF EXISTS moderation_actions CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS mutes CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS notification_preferences CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS session_capabilities CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS operational_controls CASCADE;

UPDATE schema_metadata SET value = '001', updated_at = NOW() WHERE key = 'schema_version';
