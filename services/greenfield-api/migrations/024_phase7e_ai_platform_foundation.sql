-- Phase 7E Block 8: Greenfield AI platform foundation.
-- This is infrastructure only. Provider credentials, autonomous planning,
-- embeddings, RAG, fine-tuning, billing, and module AI features are deferred.

CREATE TABLE IF NOT EXISTS greenfield_ai_providers (
  provider_id TEXT PRIMARY KEY,
  provider_kind TEXT NOT NULL CHECK (provider_kind IN ('openai','anthropic','google','ollama','lm-studio','azure-openai','local','future')),
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available','unconfigured','disabled','degraded','retired')),
  configuration_mode TEXT NOT NULL CHECK (configuration_mode IN ('server-managed','account-managed','local-runtime','future')),
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(capabilities) = 'array'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS greenfield_ai_providers_kind_status_idx
  ON greenfield_ai_providers(provider_kind, status);

CREATE TABLE IF NOT EXISTS greenfield_ai_models (
  model_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES greenfield_ai_providers(provider_id) ON DELETE RESTRICT,
  provider_kind TEXT NOT NULL CHECK (provider_kind IN ('openai','anthropic','google','ollama','lm-studio','azure-openai','local','future')),
  provider_model_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(capabilities) = 'array'),
  supports_streaming BOOLEAN NOT NULL DEFAULT FALSE,
  supports_structured_outputs BOOLEAN NOT NULL DEFAULT FALSE,
  supports_reasoning BOOLEAN NOT NULL DEFAULT FALSE,
  supports_vision BOOLEAN NOT NULL DEFAULT FALSE,
  supports_image_generation BOOLEAN NOT NULL DEFAULT FALSE,
  supports_embeddings BOOLEAN NOT NULL DEFAULT FALSE,
  supports_audio BOOLEAN NOT NULL DEFAULT FALSE,
  availability TEXT NOT NULL CHECK (availability IN ('available','unavailable','coming-soon')),
  lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN ('active','preview','deprecated','retired')),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  policy_tags JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(policy_tags) = 'array'),
  limits JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(limits) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id, provider_model_id)
);
CREATE INDEX IF NOT EXISTS greenfield_ai_models_enabled_idx
  ON greenfield_ai_models(enabled, availability, lifecycle_status);

CREATE TABLE IF NOT EXISTS greenfield_ai_prompts (
  prompt_id TEXT NOT NULL,
  version TEXT NOT NULL,
  owner TEXT NOT NULL,
  module_id TEXT,
  purpose TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(variables) = 'array'),
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(output_schema) = 'object'),
  safety_policy JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(safety_policy) = 'object'),
  lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN ('draft','active','deprecated','retired')),
  prompt_template TEXT NOT NULL,
  template_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(prompt_id, version)
);
CREATE INDEX IF NOT EXISTS greenfield_ai_prompts_module_idx
  ON greenfield_ai_prompts(module_id, lifecycle_status);

CREATE TABLE IF NOT EXISTS greenfield_ai_request_ledger (
  request_id TEXT PRIMARY KEY,
  requesting_module_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  actor_id TEXT,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE SET NULL,
  conversation_id TEXT,
  correlation_id TEXT NOT NULL,
  provider_id TEXT REFERENCES greenfield_ai_providers(provider_id) ON DELETE SET NULL,
  model_id TEXT REFERENCES greenfield_ai_models(model_id) ON DELETE SET NULL,
  prompt_id TEXT,
  prompt_version TEXT,
  required_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(required_capabilities) = 'array'),
  policy_context JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(policy_context) = 'object'),
  response_schema JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(response_schema) = 'object'),
  safety_requirements JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(safety_requirements) = 'object'),
  context_summary JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(context_summary) = 'object'),
  streaming_requested BOOLEAN NOT NULL DEFAULT FALSE,
  streaming_used BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL CHECK (status IN ('accepted','running','completed','failed','cancelled','denied')),
  timeout_ms INTEGER NOT NULL CHECK (timeout_ms BETWEEN 1000 AND 120000),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  total_tokens INTEGER CHECK (total_tokens IS NULL OR total_tokens >= 0),
  estimated_cost_microunits BIGINT CHECK (estimated_cost_microunits IS NULL OR estimated_cost_microunits >= 0),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  failure_code TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS greenfield_ai_request_ledger_account_idx
  ON greenfield_ai_request_ledger(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS greenfield_ai_request_ledger_module_idx
  ON greenfield_ai_request_ledger(requesting_module_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS greenfield_ai_request_ledger_correlation_idx
  ON greenfield_ai_request_ledger(correlation_id);

CREATE TABLE IF NOT EXISTS greenfield_ai_tool_declarations (
  tool_id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE SET NULL,
  version TEXT NOT NULL,
  description TEXT NOT NULL,
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(input_schema) = 'object'),
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(output_schema) = 'object'),
  side_effects TEXT NOT NULL CHECK (side_effects IN ('none','internal-write','external-write','financial','destructive')),
  confirmation TEXT NOT NULL CHECK (confirmation IN ('none','user','reauthentication','operator')),
  required_permissions JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(required_permissions) = 'array'),
  lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN ('active','disabled','deprecated','retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS greenfield_ai_tool_declarations_module_idx
  ON greenfield_ai_tool_declarations(module_id, lifecycle_status);

CREATE TABLE IF NOT EXISTS greenfield_ai_tool_runs (
  tool_run_id TEXT PRIMARY KEY,
  request_id TEXT REFERENCES greenfield_ai_request_ledger(request_id) ON DELETE SET NULL,
  tool_id TEXT NOT NULL REFERENCES greenfield_ai_tool_declarations(tool_id) ON DELETE RESTRICT,
  module_id TEXT NOT NULL,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE SET NULL,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  actor_id TEXT,
  argument_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('validated','confirmation_required','completed','failed','denied')),
  confirmation_status TEXT NOT NULL CHECK (confirmation_status IN ('not-required','required','confirmed','denied')),
  failure_code TEXT,
  redacted_details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(redacted_details) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS greenfield_ai_tool_runs_request_idx
  ON greenfield_ai_tool_runs(request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS greenfield_ai_streams (
  stream_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES greenfield_ai_request_ledger(request_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  actor_id TEXT,
  module_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','reconnecting','completed','cancelled','failed')),
  last_sequence INTEGER NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
  structured_completion JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(structured_completion) = 'object'),
  usage_delta JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(usage_delta) = 'object'),
  cancellation_requested_at TIMESTAMPTZ,
  reconnect_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS greenfield_ai_streams_request_idx
  ON greenfield_ai_streams(request_id);

GRANT SELECT, INSERT, UPDATE ON greenfield_ai_providers TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE ON greenfield_ai_models TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE ON greenfield_ai_prompts TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE ON greenfield_ai_request_ledger TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE ON greenfield_ai_tool_declarations TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE ON greenfield_ai_tool_runs TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE ON greenfield_ai_streams TO modula_api, modula_worker;

INSERT INTO greenfield_ai_providers (
  provider_id,
  provider_kind,
  display_name,
  status,
  configuration_mode,
  capabilities,
  metadata
) VALUES
  ('provider:openai', 'openai', 'OpenAI', 'unconfigured', 'server-managed', '["chat","text-generation","streaming","structured-output","reasoning","vision","image-generation","embeddings","audio","tool-calling"]'::jsonb, '{"managedBy":"greenfield-ai-gateway"}'::jsonb),
  ('provider:anthropic', 'anthropic', 'Anthropic', 'unconfigured', 'server-managed', '["chat","text-generation","streaming","structured-output","reasoning","vision","tool-calling"]'::jsonb, '{"managedBy":"greenfield-ai-gateway"}'::jsonb),
  ('provider:local', 'local', 'Local Models', 'unconfigured', 'local-runtime', '["chat","text-generation","streaming","structured-output","embeddings"]'::jsonb, '{"managedBy":"greenfield-ai-gateway"}'::jsonb)
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
  ('greenfield.openai.general', 'provider:openai', 'openai', 'configured-by-admin', 'OpenAI General Model', '["chat","text-generation","streaming","structured-output","tool-calling"]'::jsonb, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, 'unavailable', 'preview', FALSE, '["admin-enable-required"]'::jsonb, '{}'::jsonb),
  ('greenfield.anthropic.general', 'provider:anthropic', 'anthropic', 'configured-by-admin', 'Anthropic General Model', '["chat","text-generation","streaming","structured-output","reasoning","tool-calling"]'::jsonb, TRUE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, 'unavailable', 'preview', FALSE, '["admin-enable-required"]'::jsonb, '{}'::jsonb),
  ('greenfield.local.general', 'provider:local', 'local', 'configured-by-admin', 'Local General Model', '["chat","text-generation","streaming","structured-output"]'::jsonb, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, 'unavailable', 'preview', FALSE, '["local-runtime-required"]'::jsonb, '{}'::jsonb)
ON CONFLICT (model_id) DO NOTHING;

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','024')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
