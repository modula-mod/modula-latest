-- 102_cloud_model_providers
--
-- Direct cloud model providers alongside the existing Modula AI backend proxy:
-- Anthropic already had a seed row (migration 024) but no direct adapter; this
-- migration adds the Google Gemini provider + general model seed, so the new
-- direct adapters (services/greenfield-api/src/ai/providers/) have registry
-- rows to resolve against.
--
-- It also adds per-account cloud preferences (greenfield_ai_account_preferences):
-- the cloud opt-in gate (allow_remote_cloud, default FALSE — fail-closed to
-- local), the account's default routing strategy, an optional preferred
-- provider, and an optional monthly spend budget in minor currency units.
-- The budget is enforced by the existing quota machinery: the preferences
-- service mirrors it into an `estimated-spend` usage-limit row, so no new
-- enforcement path is introduced.
--
-- Seeded providers/models stay `unconfigured` / `unavailable` / disabled,
-- exactly like the 024 seeds: an operator enables a real model only after
-- configuring credentials (platform or account scope) via the AI routes.
-- No API keys anywhere in this migration.

INSERT INTO greenfield_ai_providers (
  provider_id,
  provider_kind,
  display_name,
  status,
  configuration_mode,
  capabilities,
  metadata
) VALUES
  ('provider:gemini', 'google', 'Google Gemini', 'unconfigured', 'server-managed', '["chat","text-generation","streaming","structured-output","reasoning","vision","tool-calling"]'::jsonb, '{"managedBy":"greenfield-ai-gateway"}'::jsonb)
ON CONFLICT (provider_id) DO NOTHING;

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
) VALUES
  ('greenfield.gemini.general', 'provider:gemini', 'google', 'configured-by-admin', 'Gemini General Model', '["chat","text-generation","streaming","structured-output","vision","tool-calling"]'::jsonb, TRUE, TRUE, FALSE, TRUE, FALSE, FALSE, FALSE, 'unavailable', 'preview', FALSE, '["admin-enable-required"]'::jsonb, '{}'::jsonb)
ON CONFLICT (model_id) DO NOTHING;

CREATE TABLE greenfield_ai_account_preferences (
  account_id TEXT PRIMARY KEY REFERENCES greenfield_accounts(account_id),
  allow_remote_cloud BOOLEAN NOT NULL DEFAULT FALSE,
  default_routing_strategy TEXT NOT NULL DEFAULT 'local-first',
  preferred_provider_id TEXT NULL REFERENCES greenfield_ai_providers(provider_id),
  monthly_budget_minor_units INTEGER NULL CHECK (monthly_budget_minor_units IS NULL OR monthly_budget_minor_units > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
REVOKE ALL ON greenfield_ai_account_preferences FROM PUBLIC, modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE ON greenfield_ai_account_preferences TO modula_api, modula_worker;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '102')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = pg_catalog.clock_timestamp();
