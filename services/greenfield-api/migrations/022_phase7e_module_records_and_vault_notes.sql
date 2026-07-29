-- Phase 7E Block 6: generic module record revisions, exports and Vault Notes search entities.

ALTER TABLE greenfield_module_actions
  DROP CONSTRAINT IF EXISTS greenfield_module_actions_action_kind_check;
ALTER TABLE greenfield_module_actions
  ADD CONSTRAINT greenfield_module_actions_action_kind_check
  CHECK (action_kind IN ('route.open','record.create','record.update','record.delete','record.restore','record.purge','record.query','function.invoke','settings.update','share','dismiss'));

ALTER TABLE greenfield_module_record_events
  DROP CONSTRAINT IF EXISTS greenfield_module_record_events_operation_check;
ALTER TABLE greenfield_module_record_events
  ADD CONSTRAINT greenfield_module_record_events_operation_check
  CHECK (operation IN ('create','update','delete','restore','move','purge'));

CREATE TABLE IF NOT EXISTS greenfield_module_record_versions (
  version_id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  collection TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  next_revision INTEGER NOT NULL CHECK (next_revision > revision),
  data_snapshot JSONB NOT NULL CHECK (jsonb_typeof(data_snapshot) = 'object'),
  payload_hash TEXT NOT NULL,
  change_source TEXT NOT NULL CHECK (change_source IN ('update','restore','import','delete')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, module_id, collection, record_id, revision)
);
CREATE INDEX IF NOT EXISTS greenfield_module_record_versions_record_idx
  ON greenfield_module_record_versions(account_id, module_id, collection, record_id, revision DESC);

CREATE TABLE IF NOT EXISTS greenfield_module_export_jobs (
  export_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE SET NULL,
  format TEXT NOT NULL CHECK (format IN ('json','markdown','plain-text','zip')),
  state TEXT NOT NULL CHECK (state IN ('queued','running','completed','failed','cancelled')),
  manifest JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(manifest) = 'object'),
  record_count INTEGER NOT NULL DEFAULT 0 CHECK (record_count >= 0),
  output_ref TEXT,
  failure_code TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS greenfield_module_export_jobs_account_idx
  ON greenfield_module_export_jobs(account_id, module_id, created_at DESC);

ALTER TABLE search_documents DROP CONSTRAINT IF EXISTS search_documents_entity_type_check;
ALTER TABLE search_documents
  ADD CONSTRAINT search_documents_entity_type_check
  CHECK (entity_type IN ('post','profile','module','module-release','note','vault-folder'));

ALTER TABLE search_projection_state DROP CONSTRAINT IF EXISTS search_projection_state_entity_type_check;
ALTER TABLE search_projection_state
  ADD CONSTRAINT search_projection_state_entity_type_check
  CHECK (entity_type IN ('post','profile','module','module-release','note','vault-folder'));

ALTER TABLE search_projection_failures DROP CONSTRAINT IF EXISTS search_projection_failures_entity_type_check;
ALTER TABLE search_projection_failures
  ADD CONSTRAINT search_projection_failures_entity_type_check
  CHECK (entity_type IN ('post','profile','module','module-release','note','vault-folder'));

ALTER TABLE search_reindex_requests DROP CONSTRAINT IF EXISTS search_reindex_requests_entity_type_check;
ALTER TABLE search_reindex_requests
  ADD CONSTRAINT search_reindex_requests_entity_type_check
  CHECK (entity_type IS NULL OR entity_type IN ('post','profile','module','module-release','note','vault-folder'));

WITH registry(event_type, owner, aggregate_type, classification, replay_policy, retention_policy) AS (
  VALUES
    ('vault-notes.note.created','vault-notes','note','private','guarded-idempotent','standard-module-record-retention'),
    ('vault-notes.note.updated','vault-notes','note','private','guarded-idempotent','standard-module-record-retention'),
    ('vault-notes.note.archived','vault-notes','note','private','guarded-idempotent','standard-module-record-retention'),
    ('vault-notes.note.unarchived','vault-notes','note','private','guarded-idempotent','standard-module-record-retention'),
    ('vault-notes.note.deleted','vault-notes','note','private','manual-approval-required','standard-module-record-retention'),
    ('vault-notes.note.restored','vault-notes','note','private','manual-approval-required','standard-module-record-retention'),
    ('vault-notes.note.permanently-deleted','vault-notes','note','sensitive','manual-approval-required','standard-module-record-retention'),
    ('vault-notes.note.duplicated','vault-notes','note','private','guarded-idempotent','standard-module-record-retention'),
    ('vault-notes.note.exported','vault-notes','noteExport','sensitive','manual-approval-required','module-export-retention'),
    ('vault-notes.folder.created','vault-notes','vault-folder','private','guarded-idempotent','standard-module-record-retention'),
    ('vault-notes.folder.updated','vault-notes','vault-folder','private','guarded-idempotent','standard-module-record-retention'),
    ('vault-notes.folder.deleted','vault-notes','vault-folder','private','manual-approval-required','standard-module-record-retention')
)
INSERT INTO greenfield_event_schema_registry (
  event_type,
  event_version,
  owner,
  aggregate_type,
  json_schema,
  compatibility_policy,
  retention_policy,
  data_classification,
  permitted_subscribers,
  replay_policy,
  lifecycle_state,
  created_at,
  updated_at
)
SELECT
  event_type,
  '1.0.0',
  owner,
  aggregate_type,
  jsonb_build_object('$schema','https://json-schema.org/draft/2020-12/schema','type','object','additionalProperties',true,'description',event_type || ' redacted payload'),
  'backward-compatible-additive',
  retention_policy,
  classification,
  '["greenfield.audit","greenfield.search.private","greenfield.diagnostics"]'::jsonb,
  replay_policy,
  'active',
  NOW(),
  NOW()
FROM registry
ON CONFLICT (event_type, event_version) DO UPDATE SET
  owner = EXCLUDED.owner,
  aggregate_type = EXCLUDED.aggregate_type,
  json_schema = EXCLUDED.json_schema,
  retention_policy = EXCLUDED.retention_policy,
  data_classification = EXCLUDED.data_classification,
  permitted_subscribers = EXCLUDED.permitted_subscribers,
  replay_policy = EXCLUDED.replay_policy,
  lifecycle_state = EXCLUDED.lifecycle_state,
  updated_at = NOW();

WITH subscriptions(event_type, entity_type) AS (
  VALUES
    ('vault-notes.note.created','note'),
    ('vault-notes.note.updated','note'),
    ('vault-notes.note.archived','note'),
    ('vault-notes.note.unarchived','note'),
    ('vault-notes.note.deleted','note'),
    ('vault-notes.note.restored','note'),
    ('vault-notes.note.permanently-deleted','note'),
    ('vault-notes.folder.created','vault-folder'),
    ('vault-notes.folder.updated','vault-folder'),
    ('vault-notes.folder.deleted','vault-folder')
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

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO modula_api, modula_worker;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','022') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
