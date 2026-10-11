-- MODULE-PLATFORM-02: generic record identity, immutable revisions,
-- relationships, mutation idempotency and incremental sync.

CREATE TABLE greenfield_module_record_revisions (
  revision_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  -- Kept as durable provenance when an installation is later removed.
  installation_id TEXT,
  module_id TEXT NOT NULL,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  base_revision INTEGER CHECK (base_revision IS NULL OR base_revision >= 0),
  operation TEXT NOT NULL CHECK (operation IN ('create','update','delete','restore','import')),
  mutation_id TEXT,
  actor_id TEXT,
  data_snapshot JSONB NOT NULL CHECK (jsonb_typeof(data_snapshot) = 'object'),
  visibility TEXT NOT NULL CHECK (visibility IN ('private','teams','followers','public','system')),
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  payload_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, module_id, record_type, record_id, revision)
);
CREATE INDEX greenfield_module_record_revisions_record_idx
  ON greenfield_module_record_revisions(account_id, module_id, record_type, record_id, revision DESC);

CREATE TABLE greenfield_module_record_mutations (
  mutation_row_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  mutation_id TEXT NOT NULL CHECK (char_length(mutation_id) BETWEEN 1 AND 200),
  operation TEXT NOT NULL CHECK (operation IN ('create','update','delete','restore')),
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','completed')),
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(account_id, installation_id, mutation_id)
);
CREATE INDEX greenfield_module_record_mutations_record_idx
  ON greenfield_module_record_mutations(account_id, module_id, record_type, record_id, created_at DESC);

CREATE TABLE greenfield_module_record_references (
  reference_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  source_installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  source_module_id TEXT NOT NULL,
  source_record_type TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  source_revision INTEGER NOT NULL CHECK (source_revision > 0),
  field_path TEXT NOT NULL,
  ordinal INTEGER NOT NULL DEFAULT 0 CHECK (ordinal >= 0),
  target_module_id TEXT NOT NULL,
  target_record_type TEXT NOT NULL,
  target_record_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, source_module_id, source_record_type, source_record_id, field_path, ordinal)
);
CREATE INDEX greenfield_module_record_references_source_idx
  ON greenfield_module_record_references(account_id, source_module_id, source_record_type, source_record_id, field_path, ordinal);
CREATE INDEX greenfield_module_record_references_target_idx
  ON greenfield_module_record_references(account_id, target_module_id, target_record_type, target_record_id, field_path);

CREATE TABLE greenfield_module_record_changes (
  change_sequence BIGSERIAL PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  -- Sync history remains durable across uninstall/reinstall boundaries. Cursors
  -- are still scoped to the current installation identity by the API.
  installation_id TEXT,
  module_id TEXT NOT NULL,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  operation TEXT NOT NULL CHECK (operation IN ('create','update','delete','restore','import','purge')),
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_module_record_changes_sync_idx
  ON greenfield_module_record_changes(account_id, installation_id, module_id, change_sequence);

INSERT INTO greenfield_module_record_revisions (
  revision_id, account_id, installation_id, module_id, record_type, record_id,
  revision, base_revision, operation, mutation_id, actor_id, data_snapshot,
  visibility, deleted, payload_hash, created_at
)
SELECT
  'mp02-import:' || md5(concat_ws(':', account_id, module_id, collection, record_id, revision::text)),
  account_id, installation_id, module_id, collection, record_id, revision,
  CASE WHEN revision > 1 THEN revision - 1 ELSE NULL END,
  'import', NULL, NULL, data, visibility, deleted_at IS NOT NULL,
  encode(sha256(convert_to(data::text, 'UTF8')), 'hex'), updated_at
FROM greenfield_module_records
ON CONFLICT (account_id, module_id, record_type, record_id, revision) DO NOTHING;

INSERT INTO greenfield_module_record_changes (
  account_id, installation_id, module_id, record_type, record_id, revision,
  operation, deleted, created_at
)
SELECT account_id, installation_id, module_id, collection, record_id, revision,
       'import', deleted_at IS NOT NULL, updated_at
FROM greenfield_module_records
WHERE installation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION prevent_module_record_revision_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Account erasure remains possible under the parent table's ON DELETE
  -- CASCADE privacy lifecycle. Application/API principals cannot delete a
  -- revision while the owning account exists.
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM greenfield_accounts WHERE account_id = OLD.account_id
  ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'greenfield_module_record_revisions is append-only';
END;
$$;

CREATE TRIGGER greenfield_module_record_revisions_immutable
BEFORE UPDATE OR DELETE ON greenfield_module_record_revisions
FOR EACH ROW EXECUTE FUNCTION prevent_module_record_revision_mutation();

REVOKE ALL ON greenfield_module_record_revisions,
  greenfield_module_record_mutations,
  greenfield_module_record_references,
  greenfield_module_record_changes FROM modula_api, modula_worker;
GRANT SELECT, INSERT ON greenfield_module_record_revisions TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE ON greenfield_module_record_mutations TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_module_record_references TO modula_api, modula_worker;
GRANT SELECT, INSERT ON greenfield_module_record_changes TO modula_api, modula_worker;
GRANT USAGE, SELECT ON SEQUENCE greenfield_module_record_changes_change_sequence_seq TO modula_api, modula_worker;
GRANT SELECT ON greenfield_module_record_revisions,
  greenfield_module_record_mutations,
  greenfield_module_record_references,
  greenfield_module_record_changes TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '068')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
