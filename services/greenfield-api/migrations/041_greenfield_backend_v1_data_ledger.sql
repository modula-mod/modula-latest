-- Greenfield Backend V1: authoritative, product-neutral data-resource ledger.
--
-- This ledger records ownership, provenance, schema, storage, retention, backup,
-- export and deletion bindings. It does not store product payloads or credentials.

CREATE TABLE IF NOT EXISTS greenfield_data_resources (
  resource_id TEXT PRIMARY KEY,
  resource_key TEXT NOT NULL,
  owner_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  product_id TEXT NOT NULL,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id),
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id),
  schema_id TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  primary_storage_mode TEXT NOT NULL CHECK (primary_storage_mode IN ('greenfield-records','dedicated-postgres','object-storage','external-service')),
  backend_service_id TEXT,
  export_handler TEXT NOT NULL,
  delete_handler TEXT NOT NULL,
  encryption_classification TEXT NOT NULL CHECK (encryption_classification IN ('public','internal','private','sensitive','restricted')),
  lifecycle_state TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (lifecycle_state IN ('ACTIVE','DISABLED','QUARANTINED','EXPORT_PENDING','DELETE_PENDING','RETAINED','DELETED')),
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(installation_id, resource_key),
  UNIQUE(owner_account_id, product_id, idempotency_key),
  CHECK (length(resource_key) BETWEEN 3 AND 240),
  CHECK (length(schema_id) BETWEEN 3 AND 240),
  CHECK (length(schema_version) BETWEEN 1 AND 80),
  CHECK (length(export_handler) BETWEEN 3 AND 240),
  CHECK (length(delete_handler) BETWEEN 3 AND 240)
);
CREATE INDEX IF NOT EXISTS greenfield_data_resources_owner_idx
  ON greenfield_data_resources(owner_account_id, product_id, lifecycle_state, updated_at DESC);
CREATE INDEX IF NOT EXISTS greenfield_data_resources_installation_idx
  ON greenfield_data_resources(installation_id, lifecycle_state);
CREATE INDEX IF NOT EXISTS greenfield_data_resources_release_idx
  ON greenfield_data_resources(release_id);

CREATE OR REPLACE FUNCTION greenfield_validate_data_resource_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM greenfield_extension_installations installation
    JOIN greenfield_module_releases release
      ON release.extension_version_id = installation.extension_version_id
    WHERE installation.installation_id = NEW.installation_id
      AND installation.account_id = NEW.owner_account_id
      AND release.release_id = NEW.release_id
      AND release.module_id = NEW.product_id
  ) THEN
    RAISE EXCEPTION 'data resource scope does not match its account, product, installation and release'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS greenfield_data_resources_scope_guard ON greenfield_data_resources;
CREATE TRIGGER greenfield_data_resources_scope_guard
  BEFORE INSERT OR UPDATE OF owner_account_id, product_id, installation_id, release_id
  ON greenfield_data_resources
  FOR EACH ROW
  EXECUTE FUNCTION greenfield_validate_data_resource_scope();

CREATE TABLE IF NOT EXISTS greenfield_data_resource_owners (
  owner_binding_id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES greenfield_data_resources(resource_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  owner_role TEXT NOT NULL CHECK (owner_role IN ('primary','shared','controller')),
  provenance TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  UNIQUE(resource_id, account_id, owner_role)
);
CREATE UNIQUE INDEX IF NOT EXISTS greenfield_data_resource_primary_owner_idx
  ON greenfield_data_resource_owners(resource_id)
  WHERE owner_role = 'primary' AND released_at IS NULL;
CREATE INDEX IF NOT EXISTS greenfield_data_resource_owners_account_idx
  ON greenfield_data_resource_owners(account_id, released_at);

CREATE TABLE IF NOT EXISTS greenfield_data_storage_bindings (
  binding_id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES greenfield_data_resources(resource_id) ON DELETE CASCADE,
  storage_mode TEXT NOT NULL CHECK (storage_mode IN ('greenfield-records','dedicated-postgres','object-storage','external-service')),
  service_id TEXT,
  locator_ref TEXT NOT NULL,
  credential_ref TEXT CHECK (credential_ref IS NULL OR credential_ref ~ '^secret://[a-z0-9._/-]+$'),
  encryption_classification TEXT NOT NULL CHECK (encryption_classification IN ('public','internal','private','sensitive','restricted')),
  state TEXT NOT NULL CHECK (state IN ('PROVISIONING','ACTIVE','DEGRADED','RETIRED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMPTZ,
  UNIQUE(resource_id, storage_mode, locator_ref),
  CHECK (locator_ref ~ '^(greenfield|storage|postgres|object|service)://[A-Za-z0-9._:/-]+$')
);
CREATE INDEX IF NOT EXISTS greenfield_data_storage_bindings_resource_idx
  ON greenfield_data_storage_bindings(resource_id, state);
CREATE INDEX IF NOT EXISTS greenfield_data_storage_bindings_service_idx
  ON greenfield_data_storage_bindings(service_id, state)
  WHERE service_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS greenfield_data_schema_versions (
  schema_version_id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES greenfield_data_resources(resource_id) ON DELETE CASCADE,
  schema_id TEXT NOT NULL,
  version TEXT NOT NULL,
  definition_sha256 TEXT CHECK (definition_sha256 IS NULL OR definition_sha256 ~ '^[0-9a-f]{64}$'),
  compatibility TEXT NOT NULL CHECK (compatibility IN ('BACKWARD','FORWARD','FULL','BREAKING','UNSPECIFIED')),
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id),
  state TEXT NOT NULL CHECK (state IN ('DECLARED','ACTIVE','SUPERSEDED','REVOKED')),
  declared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  UNIQUE(resource_id, version)
);
CREATE INDEX IF NOT EXISTS greenfield_data_schema_versions_resource_idx
  ON greenfield_data_schema_versions(resource_id, state, declared_at DESC);

CREATE TABLE IF NOT EXISTS greenfield_data_migration_history (
  migration_history_id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES greenfield_data_resources(resource_id) ON DELETE CASCADE,
  migration_id TEXT NOT NULL,
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  migration_sha256 TEXT NOT NULL CHECK (migration_sha256 ~ '^[0-9a-f]{64}$'),
  reversible BOOLEAN NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('PLANNED','RUNNING','SUCCEEDED','FAILED','ROLLED_BACK')),
  attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt >= 1),
  audit_ref TEXT NOT NULL,
  error_class TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(resource_id, migration_id, attempt)
);
CREATE INDEX IF NOT EXISTS greenfield_data_migration_history_resource_idx
  ON greenfield_data_migration_history(resource_id, created_at DESC);

CREATE TABLE IF NOT EXISTS greenfield_data_retention_policies (
  retention_policy_id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL UNIQUE REFERENCES greenfield_data_resources(resource_id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('RETAIN','DELETE_ON_UNINSTALL','ARCHIVE_ON_UNINSTALL','TTL','LEGAL_HOLD')),
  ttl_days INTEGER CHECK (ttl_days IS NULL OR ttl_days > 0),
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  policy_version TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((mode = 'TTL' AND ttl_days IS NOT NULL) OR (mode <> 'TTL' AND ttl_days IS NULL))
);

CREATE TABLE IF NOT EXISTS greenfield_data_backup_policies (
  backup_policy_id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL UNIQUE REFERENCES greenfield_data_resources(resource_id) ON DELETE CASCADE,
  responsibility TEXT NOT NULL CHECK (responsibility IN ('GREENFIELD','PRODUCT_SERVICE','EXTERNAL_PROVIDER','NOT_APPLICABLE')),
  mode TEXT NOT NULL CHECK (mode IN ('MANAGED','DECLARED','EXTERNAL','NONE')),
  schedule_ref TEXT,
  recovery_point_objective_seconds INTEGER CHECK (recovery_point_objective_seconds IS NULL OR recovery_point_objective_seconds >= 0),
  recovery_time_objective_seconds INTEGER CHECK (recovery_time_objective_seconds IS NULL OR recovery_time_objective_seconds >= 0),
  last_backup_ref TEXT,
  last_backup_at TIMESTAMPTZ,
  last_restore_test_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Existing Standard 2 storage allocations become ledger declarations. These
-- bindings describe control-plane truth only; they do not invent a physical DB,
-- object or service that has not been provisioned.
INSERT INTO greenfield_data_resources (
  resource_id,
  resource_key,
  owner_account_id,
  product_id,
  installation_id,
  release_id,
  schema_id,
  schema_version,
  primary_storage_mode,
  backend_service_id,
  export_handler,
  delete_handler,
  encryption_classification,
  lifecycle_state,
  idempotency_key,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  'data-resource:' || allocation.allocation_id,
  allocation.storage_key,
  allocation.account_id,
  allocation.module_id,
  allocation.installation_id,
  allocation.release_id,
  COALESCE(NULLIF(allocation.declaration->>'schemaId', ''), allocation.storage_key),
  COALESCE(NULLIF(allocation.declaration->>'version', ''), '1.0.0'),
  CASE
    WHEN allocation.storage_kind IN ('object-storage','attachments') THEN 'object-storage'
    ELSE 'greenfield-records'
  END,
  NULL,
  allocation.module_id || '.data.export',
  allocation.module_id || '.data.delete',
  CASE WHEN allocation.encrypted THEN 'sensitive' ELSE 'private' END,
  CASE
    WHEN allocation.status = 'disabled' THEN 'DISABLED'
    WHEN allocation.status = 'quarantined' THEN 'QUARANTINED'
    WHEN allocation.status = 'released' THEN 'RETAINED'
    ELSE 'ACTIVE'
  END,
  'migration-041:' || allocation.allocation_id,
  allocation.created_at,
  allocation.updated_at,
  NULL
FROM greenfield_module_storage_allocations allocation
ON CONFLICT (installation_id, resource_key) DO NOTHING;

INSERT INTO greenfield_data_resource_owners (
  owner_binding_id,
  resource_id,
  account_id,
  owner_role,
  provenance,
  created_at,
  released_at
)
SELECT
  'data-owner:' || allocation.allocation_id,
  'data-resource:' || allocation.allocation_id,
  allocation.account_id,
  'primary',
  'standard-2-storage-allocation',
  allocation.created_at,
  NULL
FROM greenfield_module_storage_allocations allocation
JOIN greenfield_data_resources resource
  ON resource.resource_id = 'data-resource:' || allocation.allocation_id
ON CONFLICT (resource_id, account_id, owner_role) DO NOTHING;

INSERT INTO greenfield_data_storage_bindings (
  binding_id,
  resource_id,
  storage_mode,
  service_id,
  locator_ref,
  credential_ref,
  encryption_classification,
  state,
  metadata,
  created_at,
  updated_at,
  retired_at
)
SELECT
  'data-binding:' || allocation.allocation_id,
  'data-resource:' || allocation.allocation_id,
  CASE
    WHEN allocation.storage_kind IN ('object-storage','attachments') THEN 'object-storage'
    ELSE 'greenfield-records'
  END,
  NULL,
  'greenfield://allocation/' || allocation.allocation_id,
  NULL,
  CASE WHEN allocation.encrypted THEN 'sensitive' ELSE 'private' END,
  CASE WHEN allocation.status = 'released' THEN 'RETIRED' ELSE 'ACTIVE' END,
  jsonb_build_object('source', 'greenfield_module_storage_allocations', 'storageKind', allocation.storage_kind),
  allocation.created_at,
  allocation.updated_at,
  CASE WHEN allocation.status = 'released' THEN allocation.updated_at ELSE NULL END
FROM greenfield_module_storage_allocations allocation
JOIN greenfield_data_resources resource
  ON resource.resource_id = 'data-resource:' || allocation.allocation_id
ON CONFLICT (resource_id, storage_mode, locator_ref) DO NOTHING;

INSERT INTO greenfield_data_schema_versions (
  schema_version_id,
  resource_id,
  schema_id,
  version,
  definition_sha256,
  compatibility,
  release_id,
  state,
  declared_at,
  activated_at,
  superseded_at
)
SELECT
  'data-schema:' || allocation.allocation_id || ':' || COALESCE(NULLIF(allocation.declaration->>'version', ''), '1.0.0'),
  'data-resource:' || allocation.allocation_id,
  COALESCE(NULLIF(allocation.declaration->>'schemaId', ''), allocation.storage_key),
  COALESCE(NULLIF(allocation.declaration->>'version', ''), '1.0.0'),
  CASE
    WHEN allocation.declaration->>'schemaSha256' ~ '^[0-9a-f]{64}$' THEN allocation.declaration->>'schemaSha256'
    ELSE NULL
  END,
  'UNSPECIFIED',
  allocation.release_id,
  'ACTIVE',
  allocation.created_at,
  allocation.created_at,
  NULL
FROM greenfield_module_storage_allocations allocation
JOIN greenfield_data_resources resource
  ON resource.resource_id = 'data-resource:' || allocation.allocation_id
ON CONFLICT (resource_id, version) DO NOTHING;

INSERT INTO greenfield_data_retention_policies (
  retention_policy_id,
  resource_id,
  mode,
  ttl_days,
  legal_hold,
  policy_version,
  metadata,
  created_at,
  updated_at
)
SELECT
  'data-retention:' || allocation.allocation_id,
  'data-resource:' || allocation.allocation_id,
  CASE
    WHEN allocation.retention_policy = 'delete-on-uninstall' THEN 'DELETE_ON_UNINSTALL'
    WHEN allocation.retention_policy = 'archive-on-uninstall' THEN 'ARCHIVE_ON_UNINSTALL'
    ELSE 'RETAIN'
  END,
  NULL,
  FALSE,
  '1.0.0',
  jsonb_build_object('declaredPolicy', allocation.retention_policy),
  allocation.created_at,
  allocation.updated_at
FROM greenfield_module_storage_allocations allocation
JOIN greenfield_data_resources resource
  ON resource.resource_id = 'data-resource:' || allocation.allocation_id
ON CONFLICT (resource_id) DO NOTHING;

INSERT INTO greenfield_data_backup_policies (
  backup_policy_id,
  resource_id,
  responsibility,
  mode,
  schedule_ref,
  recovery_point_objective_seconds,
  recovery_time_objective_seconds,
  last_backup_ref,
  last_backup_at,
  last_restore_test_at,
  metadata,
  created_at,
  updated_at
)
SELECT
  'data-backup:' || allocation.allocation_id,
  'data-resource:' || allocation.allocation_id,
  'GREENFIELD',
  'MANAGED',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  jsonb_build_object('source', 'standard-2-storage-allocation'),
  allocation.created_at,
  allocation.updated_at
FROM greenfield_module_storage_allocations allocation
JOIN greenfield_data_resources resource
  ON resource.resource_id = 'data-resource:' || allocation.allocation_id
ON CONFLICT (resource_id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  greenfield_data_resources,
  greenfield_data_resource_owners,
  greenfield_data_storage_bindings,
  greenfield_data_schema_versions,
  greenfield_data_migration_history,
  greenfield_data_retention_policies,
  greenfield_data_backup_policies
TO modula_api, modula_worker;

GRANT SELECT ON
  greenfield_data_resources,
  greenfield_data_resource_owners,
  greenfield_data_storage_bindings,
  greenfield_data_schema_versions,
  greenfield_data_migration_history,
  greenfield_data_retention_policies,
  greenfield_data_backup_policies
TO modula_backup;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '041')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
