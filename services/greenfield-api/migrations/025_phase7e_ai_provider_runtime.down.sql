DROP TABLE IF EXISTS ai_quota_consumption;
DROP TABLE IF EXISTS ai_usage_limits;
DROP TABLE IF EXISTS ai_provider_health;
DROP TABLE IF EXISTS ai_stream_events;
DROP TABLE IF EXISTS ai_stream_sessions;
DROP TABLE IF EXISTS ai_execution_attempts;
DROP TABLE IF EXISTS ai_executions;
DROP TABLE IF EXISTS ai_provider_runtime_state;
DROP TABLE IF EXISTS ai_provider_credentials;

ALTER TABLE greenfield_ai_providers
  DROP CONSTRAINT IF EXISTS greenfield_ai_providers_configuration_mode_check;

UPDATE greenfield_ai_providers
SET configuration_mode = CASE
  WHEN configuration_mode = 'platform-managed' THEN 'server-managed'
  WHEN configuration_mode = 'customer-managed' THEN 'account-managed'
  WHEN configuration_mode = 'local' THEN 'local-runtime'
  WHEN configuration_mode = 'development-mock' THEN 'local-runtime'
  ELSE 'future'
END
WHERE configuration_mode NOT IN ('server-managed','account-managed','local-runtime','future');

ALTER TABLE greenfield_ai_providers
  ADD CONSTRAINT greenfield_ai_providers_configuration_mode_check
  CHECK (configuration_mode IN ('server-managed','account-managed','local-runtime','future'));

DELETE FROM greenfield_ai_models
WHERE model_id IN ('greenfield.mock.deterministic', 'greenfield.ollama.local');

DELETE FROM greenfield_ai_providers
WHERE provider_id IN ('provider:development-mock', 'provider:ollama');

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','024')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
