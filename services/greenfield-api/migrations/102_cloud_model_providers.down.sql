-- 102_cloud_model_providers (down)
--
-- Removes the per-account cloud preferences table and the Gemini seed rows
-- added by the up migration. The Anthropic seed row from migration 024 is
-- untouched.

DROP TABLE IF EXISTS greenfield_ai_account_preferences;

DELETE FROM greenfield_ai_models WHERE model_id = 'greenfield.gemini.general';
DELETE FROM greenfield_ai_providers WHERE provider_id = 'provider:gemini';

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '095')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = pg_catalog.clock_timestamp();
