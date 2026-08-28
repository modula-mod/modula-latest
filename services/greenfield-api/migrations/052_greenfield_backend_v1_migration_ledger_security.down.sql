GRANT SELECT, INSERT, UPDATE, DELETE ON schema_metadata, schema_migrations
TO modula_api, modula_worker;

REVOKE SELECT ON schema_metadata, schema_migrations
FROM modula_backup, modula_readonly;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '051')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
