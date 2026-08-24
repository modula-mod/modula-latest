-- PVP Platform Phase 2: governed extension graph and runtime projections.
-- Extends the existing module registry/install/runtime rather than replacing it.

ALTER TABLE greenfield_module_releases
  ADD COLUMN IF NOT EXISTS product_kind TEXT NOT NULL DEFAULT 'module'
    CHECK (product_kind IN ('module','addon','plugin','function','tool','widget','connector','service')),
  ADD COLUMN IF NOT EXISTS extension_product JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(extension_product) = 'object');

CREATE INDEX IF NOT EXISTS greenfield_module_releases_product_kind_idx
  ON greenfield_module_releases(product_kind, release_state, module_id);

CREATE TABLE IF NOT EXISTS greenfield_extension_targets (
  target_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_kind TEXT NOT NULL CHECK (product_kind IN ('module','addon','plugin','function','tool','widget','connector','service')),
  target_product_id TEXT NOT NULL,
  version_range TEXT NOT NULL,
  required_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(required_capabilities) = 'array'),
  required_extension_points JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(required_extension_points) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(release_id, target_product_id),
  CHECK (product_id <> target_product_id)
);
CREATE INDEX IF NOT EXISTS greenfield_extension_targets_target_idx
  ON greenfield_extension_targets(target_product_id, product_kind, product_id);

CREATE TABLE IF NOT EXISTS greenfield_extension_points (
  extension_point_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  point_key TEXT NOT NULL,
  title TEXT NOT NULL,
  contribution_kinds JSONB NOT NULL CHECK (jsonb_typeof(contribution_kinds) = 'array'),
  required_capability TEXT,
  platforms JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(platforms) = 'array'),
  max_contributions INTEGER NOT NULL DEFAULT 20 CHECK (max_contributions BETWEEN 1 AND 100),
  declaration JSONB NOT NULL CHECK (jsonb_typeof(declaration) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(release_id, point_key)
);
CREATE INDEX IF NOT EXISTS greenfield_extension_points_product_idx
  ON greenfield_extension_points(product_id, point_key);

CREATE TABLE IF NOT EXISTS greenfield_extension_installation_edges (
  edge_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  source_installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  source_product_id TEXT NOT NULL,
  target_installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE RESTRICT,
  target_product_id TEXT NOT NULL,
  relation TEXT NOT NULL CHECK (relation IN ('targets','requires','optional','recommended')),
  version_range TEXT NOT NULL,
  resolved_version TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('resolved','enabled','disabled','incompatible','removed')),
  blocking BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_installation_id, target_installation_id, relation),
  CHECK (source_installation_id <> target_installation_id),
  CHECK (source_product_id <> target_product_id)
);
CREATE INDEX IF NOT EXISTS greenfield_extension_installation_edges_target_idx
  ON greenfield_extension_installation_edges(account_id, target_product_id, state);

CREATE TABLE IF NOT EXISTS greenfield_extension_contribution_registrations (
  contribution_registration_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  extension_product_id TEXT NOT NULL,
  target_product_id TEXT NOT NULL,
  target_installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  contribution_id TEXT NOT NULL,
  contribution_kind TEXT NOT NULL CHECK (contribution_kind IN (
    'view.section','toolbar.action','editor.command','editor.attachment','menu.item','contextMenu.item',
    'settings.section','home.section','widget','record.decorator','search.provider','composer.tool','background.action'
  )),
  extension_point TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  required_capability TEXT,
  platforms JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(platforms) = 'array'),
  requires_online BOOLEAN NOT NULL DEFAULT FALSE,
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN -1000 AND 1000),
  status TEXT NOT NULL CHECK (status IN ('registered','enabled','disabled','incompatible','failed','quarantined','removed')),
  last_error_code TEXT,
  declaration JSONB NOT NULL CHECK (jsonb_typeof(declaration) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(installation_id, contribution_id, target_product_id)
);
CREATE INDEX IF NOT EXISTS greenfield_extension_contributions_host_idx
  ON greenfield_extension_contribution_registrations(account_id, target_product_id, extension_point, status, priority);

CREATE TABLE IF NOT EXISTS greenfield_extension_capability_grants (
  grant_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  consumer_installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  consumer_product_id TEXT NOT NULL,
  target_installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  target_product_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('requested','granted','denied','revoked','requires-reauthorisation')),
  scope_type TEXT NOT NULL DEFAULT 'installation' CHECK (scope_type IN ('installation','resource','action')),
  scope_ref TEXT,
  approved_by_account_id TEXT REFERENCES greenfield_accounts(account_id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT(consumer_installation_id, target_installation_id, capability, scope_type, scope_ref)
);
CREATE INDEX IF NOT EXISTS greenfield_extension_capability_grants_check_idx
  ON greenfield_extension_capability_grants(account_id, consumer_product_id, target_product_id, capability, state);

CREATE TABLE IF NOT EXISTS greenfield_extension_service_assertions (
  assertion_id TEXT PRIMARY KEY,
  jti TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  consumer_installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  consumer_product_id TEXT NOT NULL,
  target_installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  target_product_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  capabilities JSONB NOT NULL CHECK (jsonb_typeof(capabilities) = 'array'),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('installation','resource','action')),
  scope_ref TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  raw_user_bearer_forwarded BOOLEAN NOT NULL DEFAULT FALSE CHECK (raw_user_bearer_forwarded = FALSE),
  request_id TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at > issued_at),
  CHECK (expires_at <= issued_at + INTERVAL '15 minutes')
);
CREATE INDEX IF NOT EXISTS greenfield_extension_service_assertions_active_idx
  ON greenfield_extension_service_assertions(account_id, consumer_product_id, target_product_id, expires_at);

CREATE TABLE IF NOT EXISTS greenfield_extension_event_subscriptions (
  subscription_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  extension_product_id TEXT NOT NULL,
  target_product_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1 CHECK (event_version > 0),
  required_capability TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('registered','enabled','disabled','failed','quarantined','removed')),
  last_delivery_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(installation_id, target_product_id, event_type)
);
CREATE INDEX IF NOT EXISTS greenfield_extension_event_subscriptions_event_idx
  ON greenfield_extension_event_subscriptions(account_id, target_product_id, event_type, status);

CREATE TABLE IF NOT EXISTS greenfield_extension_job_executions (
  execution_id TEXT PRIMARY KEY,
  job_registration_id TEXT REFERENCES greenfield_module_job_registrations(job_registration_id) ON DELETE SET NULL,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  owner_installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  extension_product_id TEXT NOT NULL,
  target_product_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','RETRYING','CANCELLED')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  maximum_attempts INTEGER NOT NULL DEFAULT 3 CHECK (maximum_attempts BETWEEN 1 AND 10),
  idempotency_key TEXT NOT NULL,
  request_id TEXT NOT NULL,
  failure_code TEXT,
  input_hash TEXT NOT NULL,
  redacted_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(redacted_metadata) = 'object'),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_installation_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS greenfield_extension_job_executions_queue_idx
  ON greenfield_extension_job_executions(status, available_at, created_at);

CREATE TABLE IF NOT EXISTS greenfield_extension_entity_metadata (
  metadata_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  owner_installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  extension_product_id TEXT NOT NULL,
  target_product_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  namespace TEXT NOT NULL,
  value JSONB NOT NULL CHECK (jsonb_typeof(value) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, extension_product_id, entity_type, entity_id, namespace),
  CHECK (namespace = extension_product_id)
);
CREATE INDEX IF NOT EXISTS greenfield_extension_entity_metadata_target_idx
  ON greenfield_extension_entity_metadata(account_id, target_product_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS greenfield_extension_runtime_projection (
  installation_id TEXT PRIMARY KEY REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_kind TEXT NOT NULL CHECK (product_kind IN ('module','addon','plugin','function','tool','widget','connector','service')),
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'NOT_INSTALLED','RESOLVING','INSTALLING','INSTALLED','ENABLING','ENABLED','DISABLING','DISABLED',
    'UNINSTALLING','UPDATE_AVAILABLE','UPDATING','INCOMPATIBLE','QUARANTINED','FAILED'
  )),
  health_state TEXT NOT NULL DEFAULT 'healthy' CHECK (health_state IN ('healthy','degraded','unavailable','configuration-required','disabled','quarantined','failed')),
  last_error_code TEXT,
  last_error_message TEXT,
  projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, product_id)
);
CREATE INDEX IF NOT EXISTS greenfield_extension_runtime_projection_host_idx
  ON greenfield_extension_runtime_projection(account_id, product_kind, state, product_id);

WITH subscriptions(event_type, entity_type) AS (
  VALUES
    ('vault.note.created.v1', 'note'),
    ('vault.note.updated.v1', 'note'),
    ('vault.note.archived.v1', 'note'),
    ('vault.note.deleted.v1', 'note'),
    ('vault-notes.note.unarchived.v1', 'note'),
    ('vault-notes.note.restored.v1', 'note'),
    ('vault-notes.note.permanently-deleted.v1', 'note'),
    ('vault.collection.created.v1', 'vault-folder'),
    ('vault.collection.updated.v1', 'vault-folder'),
    ('vault-notes.folder.deleted.v1', 'vault-folder')
)
INSERT INTO greenfield_event_subscriptions (
  subscription_id,
  event_type,
  subscriber_id,
  target_type,
  target_key,
  filters,
  enabled,
  permitted_visibility,
  permitted_classifications,
  subscriber_timeout_ms,
  max_concurrency,
  created_at,
  updated_at
)
SELECT
  'subscription:search.vault-notes-projector:' || event_type,
  event_type,
  'search.vault-notes-projector',
  'search-index',
  entity_type,
  '{}'::jsonb,
  TRUE,
  ARRAY['account','internal','restricted']::TEXT[],
  ARRAY['private','sensitive','internal']::TEXT[],
  30000,
  4,
  NOW(),
  NOW()
FROM subscriptions
ON CONFLICT (event_type, subscriber_id) DO UPDATE SET
  target_type = EXCLUDED.target_type,
  target_key = EXCLUDED.target_key,
  filters = EXCLUDED.filters,
  permitted_visibility = EXCLUDED.permitted_visibility,
  permitted_classifications = EXCLUDED.permitted_classifications,
  subscriber_timeout_ms = EXCLUDED.subscriber_timeout_ms,
  max_concurrency = EXCLUDED.max_concurrency,
  enabled = TRUE,
  updated_at = NOW();
