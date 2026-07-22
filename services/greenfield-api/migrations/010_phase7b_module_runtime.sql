-- Phase 7B: declarative module host, UI view runtime, module records and retention.
CREATE TABLE IF NOT EXISTS greenfield_module_views (
  view_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  view_key TEXT NOT NULL,
  view_kind TEXT NOT NULL CHECK (view_kind IN ('collection','detail','form','dashboard','settings','emptyState')),
  collection TEXT,
  title TEXT NOT NULL,
  declaration JSONB NOT NULL,
  required_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  registration_status TEXT NOT NULL DEFAULT 'declared' CHECK (registration_status IN ('declared','registered','disabled','quarantined','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(release_id, view_key)
);
CREATE INDEX IF NOT EXISTS greenfield_module_views_module_idx
  ON greenfield_module_views(module_id, view_kind, registration_status);

CREATE TABLE IF NOT EXISTS greenfield_module_actions (
  action_row_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  action_kind TEXT NOT NULL CHECK (action_kind IN ('route.open','record.create','record.update','record.delete','record.query','function.invoke','settings.update','share','dismiss')),
  capability TEXT NOT NULL,
  declaration JSONB NOT NULL,
  registration_status TEXT NOT NULL DEFAULT 'declared' CHECK (registration_status IN ('declared','registered','disabled','quarantined','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(release_id, action_id)
);
CREATE INDEX IF NOT EXISTS greenfield_module_actions_module_idx
  ON greenfield_module_actions(module_id, action_kind, registration_status);

CREATE TABLE IF NOT EXISTS greenfield_module_record_collections (
  collection_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  collection TEXT NOT NULL,
  schema_ref TEXT NOT NULL,
  default_visibility TEXT NOT NULL CHECK (default_visibility IN ('private','teams','followers','public','system')),
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  searchable_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  filterable_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  sortable_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  folder_field TEXT,
  reference_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  schema_definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  retention_policy TEXT NOT NULL DEFAULT 'keepOnUninstall' CHECK (retention_policy IN ('keepOnUninstall','deleteOnUninstall','exportRequired')),
  registration_status TEXT NOT NULL DEFAULT 'declared' CHECK (registration_status IN ('declared','registered','disabled','quarantined','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(release_id, collection)
);
CREATE INDEX IF NOT EXISTS greenfield_module_record_collections_module_idx
  ON greenfield_module_record_collections(module_id, collection, registration_status);

CREATE TABLE IF NOT EXISTS greenfield_module_records (
  record_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  module_id TEXT NOT NULL,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE SET NULL,
  collection TEXT NOT NULL,
  schema_ref TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('private','teams','followers','public','system')),
  data JSONB NOT NULL,
  search_text TEXT NOT NULL DEFAULT '',
  folder_ref TEXT,
  source_uri TEXT,
  retained_after_uninstall BOOLEAN NOT NULL DEFAULT FALSE,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(account_id, module_id, collection, record_id)
);
CREATE INDEX IF NOT EXISTS greenfield_module_records_account_module_idx
  ON greenfield_module_records(account_id, module_id, collection, deleted_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS greenfield_module_records_folder_idx
  ON greenfield_module_records(account_id, module_id, collection, folder_ref)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS greenfield_module_records_search_idx
  ON greenfield_module_records USING GIN (to_tsvector('simple', search_text));

CREATE TABLE IF NOT EXISTS greenfield_module_record_events (
  event_id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  module_id TEXT NOT NULL,
  collection TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create','update','delete','restore','move')),
  revision INTEGER NOT NULL,
  previous_hash TEXT,
  event_hash TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS greenfield_module_record_events_record_idx
  ON greenfield_module_record_events(record_id, revision);
CREATE INDEX IF NOT EXISTS greenfield_module_record_events_account_idx
  ON greenfield_module_record_events(account_id, module_id, created_at DESC);

CREATE TABLE IF NOT EXISTS greenfield_module_action_events (
  event_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  module_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  action_kind TEXT NOT NULL,
  idempotency_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('validated','completed','failed','queued','cancelled')),
  input_hash TEXT NOT NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, module_id, action_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS greenfield_module_action_events_account_idx
  ON greenfield_module_action_events(account_id, module_id, created_at DESC);

CREATE TABLE IF NOT EXISTS greenfield_module_data_retention (
  retention_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  module_id TEXT NOT NULL,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE SET NULL,
  choice TEXT NOT NULL CHECK (choice IN ('keepData','exportThenDelete','deleteData')),
  record_count INTEGER NOT NULL DEFAULT 0,
  export_id TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS greenfield_module_data_retention_account_idx
  ON greenfield_module_data_retention(account_id, module_id, created_at DESC);

ALTER TABLE greenfield_extension_catalogue
  ADD COLUMN IF NOT EXISTS distribution_model TEXT NOT NULL DEFAULT 'free'
  CHECK (distribution_model IN ('free','included','internal','futurePaid','futureSubscription'));
ALTER TABLE greenfield_extension_catalogue
  ADD COLUMN IF NOT EXISTS entitlement_id TEXT;

UPDATE greenfield_extension_catalogue
SET distribution_model='internal', updated_at=NOW()
WHERE slug='digital.dimon.core';

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO modula_api, modula_worker;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','010') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
