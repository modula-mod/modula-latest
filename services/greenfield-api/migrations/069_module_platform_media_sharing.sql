-- MODULE-PLATFORM-02B: generic record/media binding and record-level sharing.

CREATE TABLE greenfield_module_record_media_bindings (
  binding_id TEXT PRIMARY KEY,
  record_owner_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  asset_id TEXT NOT NULL REFERENCES attachments(attachment_id),
  asset_owner_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE RESTRICT,
  source_installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE SET NULL,
  field_path TEXT,
  role TEXT,
  order_index INTEGER NOT NULL CHECK (order_index >= 0),
  caption TEXT,
  media_type TEXT,
  filename TEXT NOT NULL,
  size BIGINT NOT NULL CHECK (size >= 0),
  content_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT greenfield_module_record_media_asset_unique
    UNIQUE(record_owner_account_id, module_id, record_type, record_id, asset_id),
  CONSTRAINT greenfield_module_record_media_order_unique
    UNIQUE(record_owner_account_id, module_id, record_type, record_id, order_index)
    DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX greenfield_module_record_media_record_idx
  ON greenfield_module_record_media_bindings(record_owner_account_id, module_id, record_type, record_id, order_index);
CREATE INDEX greenfield_module_record_media_asset_idx
  ON greenfield_module_record_media_bindings(asset_id);

CREATE TABLE greenfield_module_record_shares (
  share_id TEXT PRIMARY KEY,
  owner_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  recipient_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  source_installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE SET NULL,
  module_id TEXT NOT NULL,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('read','edit')),
  mutation_id TEXT NOT NULL CHECK (char_length(mutation_id) BETWEEN 1 AND 200),
  payload_hash TEXT NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  visibility_lost_at TIMESTAMPTZ,
  CHECK (owner_account_id <> recipient_account_id),
  UNIQUE(owner_account_id, source_installation_id, mutation_id)
);
CREATE INDEX greenfield_module_record_shares_owner_idx
  ON greenfield_module_record_shares(owner_account_id, module_id, record_type, record_id, created_at DESC);
CREATE INDEX greenfield_module_record_shares_recipient_idx
  ON greenfield_module_record_shares(recipient_account_id, module_id, revoked_at, expires_at, created_at DESC);
CREATE UNIQUE INDEX greenfield_module_record_shares_active_recipient_idx
  ON greenfield_module_record_shares(owner_account_id, recipient_account_id, module_id, record_type, record_id)
  WHERE revoked_at IS NULL;

ALTER TABLE greenfield_module_record_changes
  ADD COLUMN owner_account_id TEXT REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  ADD COLUMN change_kind TEXT NOT NULL DEFAULT 'record'
    CHECK (change_kind IN ('record','media','sharing','visibility')),
  ADD COLUMN details JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE greenfield_module_record_changes
  DROP CONSTRAINT greenfield_module_record_changes_operation_check;
ALTER TABLE greenfield_module_record_changes
  ADD CONSTRAINT greenfield_module_record_changes_operation_check
  CHECK (operation IN ('create','update','delete','restore','import','purge','bind','unbind','reorder','metadata','share','permission','revoke','visibility-lost'));

CREATE INDEX greenfield_module_record_changes_owner_idx
  ON greenfield_module_record_changes(owner_account_id, module_id, record_type, record_id, change_sequence);

REVOKE ALL ON greenfield_module_record_media_bindings,
  greenfield_module_record_shares FROM modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_module_record_media_bindings,
  greenfield_module_record_shares TO modula_api;
GRANT SELECT ON greenfield_module_record_media_bindings,
  greenfield_module_record_shares TO modula_worker, modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '069')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
