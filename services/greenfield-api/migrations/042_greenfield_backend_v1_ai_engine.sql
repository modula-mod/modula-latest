-- Greenfield Backend V1: provider-neutral AI engine registration.
-- Provider execution is out-of-process through service.modula-ai. Credentials
-- remain in the credential broker and no provider is enabled by this migration.

INSERT INTO greenfield_ai_providers (
  provider_id,
  provider_kind,
  display_name,
  status,
  configuration_mode,
  capabilities,
  metadata
) VALUES (
  'provider:gemini',
  'google',
  'Google Gemini',
  'unconfigured',
  'platform-managed',
  '["chat","text-generation","structured-output","embeddings"]'::jsonb,
  '{"managedBy":"modula-ai-backend","executionService":"service.modula-ai","credentialSource":"modula-secrets-service","secretReference":"secret://engine.ai/provider/gemini/primary"}'::jsonb
)
ON CONFLICT (provider_id) DO UPDATE SET
  provider_kind=EXCLUDED.provider_kind,
  display_name=EXCLUDED.display_name,
  configuration_mode=EXCLUDED.configuration_mode,
  capabilities=EXCLUDED.capabilities,
  metadata=greenfield_ai_providers.metadata || EXCLUDED.metadata,
  updated_at=NOW();

INSERT INTO greenfield_ai_models (
  model_id,
  provider_id,
  provider_kind,
  provider_model_id,
  display_name,
  capabilities,
  supports_streaming,
  supports_structured_outputs,
  supports_reasoning,
  supports_vision,
  supports_image_generation,
  supports_embeddings,
  supports_audio,
  availability,
  lifecycle_status,
  enabled,
  policy_tags,
  limits
) VALUES (
  'greenfield.gemini.general',
  'provider:gemini',
  'google',
  'configured-by-admin',
  'Gemini General Model',
  '["chat","text-generation","structured-output","embeddings"]'::jsonb,
  FALSE,
  TRUE,
  FALSE,
  FALSE,
  FALSE,
  TRUE,
  FALSE,
  'unavailable',
  'preview',
  FALSE,
  '["credential-broker-required","admin-enable-required"]'::jsonb,
  '{}'::jsonb
)
ON CONFLICT (model_id) DO UPDATE SET
  provider_id=EXCLUDED.provider_id,
  provider_kind=EXCLUDED.provider_kind,
  capabilities=EXCLUDED.capabilities,
  supports_streaming=EXCLUDED.supports_streaming,
  supports_structured_outputs=EXCLUDED.supports_structured_outputs,
  supports_embeddings=EXCLUDED.supports_embeddings,
  policy_tags=EXCLUDED.policy_tags,
  updated_at=NOW();

UPDATE greenfield_ai_providers
SET configuration_mode = CASE
      WHEN provider_id IN ('provider:local', 'provider:ollama') THEN 'local'
      ELSE 'platform-managed'
    END,
    metadata = metadata || jsonb_strip_nulls(jsonb_build_object(
      'managedBy', 'modula-ai-backend',
      'executionService', 'service.modula-ai',
      'credentialSource', CASE WHEN provider_id IN ('provider:local', 'provider:ollama') THEN 'operator-local' ELSE 'modula-secrets-service' END,
      'secretReference', CASE provider_id
        WHEN 'provider:openai' THEN 'secret://engine.ai/provider/openai/primary'
        WHEN 'provider:anthropic' THEN 'secret://engine.ai/provider/anthropic/primary'
        ELSE NULL
      END
    )),
    updated_at = NOW()
WHERE provider_id IN ('provider:openai', 'provider:anthropic', 'provider:local', 'provider:ollama');

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '042')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
