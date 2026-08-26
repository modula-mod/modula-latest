DELETE FROM greenfield_ai_models WHERE model_id = 'greenfield.gemini.general';
DELETE FROM greenfield_ai_providers WHERE provider_id = 'provider:gemini';

UPDATE greenfield_ai_providers
SET configuration_mode = CASE provider_id
      WHEN 'provider:openai' THEN 'server-managed'
      WHEN 'provider:anthropic' THEN 'server-managed'
      WHEN 'provider:local' THEN 'local-runtime'
      WHEN 'provider:ollama' THEN 'local'
      ELSE configuration_mode
    END,
    metadata = (metadata - 'executionService' - 'credentialSource' - 'secretReference') || jsonb_build_object(
      'managedBy', CASE
        WHEN provider_id IN ('provider:openai', 'provider:anthropic', 'provider:local') THEN 'greenfield-ai-gateway'
        ELSE 'greenfield-ai-provider-runtime'
      END
    ),
    updated_at = NOW()
WHERE provider_id IN ('provider:openai', 'provider:anthropic', 'provider:local', 'provider:ollama');

UPDATE schema_metadata SET value='041', updated_at=NOW() WHERE key='schema_version';
