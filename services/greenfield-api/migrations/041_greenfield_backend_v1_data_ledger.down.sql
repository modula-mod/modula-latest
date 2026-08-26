REVOKE SELECT, INSERT, UPDATE, DELETE ON
  greenfield_data_resources,
  greenfield_data_resource_owners,
  greenfield_data_storage_bindings,
  greenfield_data_schema_versions,
  greenfield_data_migration_history,
  greenfield_data_retention_policies,
  greenfield_data_backup_policies
FROM modula_api, modula_worker;

REVOKE SELECT ON
  greenfield_data_resources,
  greenfield_data_resource_owners,
  greenfield_data_storage_bindings,
  greenfield_data_schema_versions,
  greenfield_data_migration_history,
  greenfield_data_retention_policies,
  greenfield_data_backup_policies
FROM modula_backup;

DROP TRIGGER IF EXISTS greenfield_data_resources_scope_guard ON greenfield_data_resources;
DROP FUNCTION IF EXISTS greenfield_validate_data_resource_scope();
DROP TABLE IF EXISTS greenfield_data_backup_policies;
DROP TABLE IF EXISTS greenfield_data_retention_policies;
DROP TABLE IF EXISTS greenfield_data_migration_history;
DROP TABLE IF EXISTS greenfield_data_schema_versions;
DROP TABLE IF EXISTS greenfield_data_storage_bindings;
DROP TABLE IF EXISTS greenfield_data_resource_owners;
DROP TABLE IF EXISTS greenfield_data_resources;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '040')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
