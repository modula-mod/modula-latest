DROP TABLE IF EXISTS greenfield_account_default_providers;
DROP FUNCTION IF EXISTS greenfield_default_provider_scope_guard();
UPDATE schema_metadata SET value='050', updated_at=NOW() WHERE key='schema_version';
