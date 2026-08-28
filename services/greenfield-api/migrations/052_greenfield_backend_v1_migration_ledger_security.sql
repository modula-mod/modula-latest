-- Greenfield Backend V1: migration provenance is migrator-owned, never runtime-writable.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON
  schema_metadata,
  schema_migrations
FROM modula_api, modula_worker, modula_backup, modula_readonly;

GRANT SELECT ON schema_metadata, schema_migrations
TO modula_api, modula_worker, modula_backup, modula_readonly;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '052')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
