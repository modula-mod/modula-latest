-- Reconcile historical production tables created before backup-role defaults
-- were consistently applied. Preserve the prior ACL state for an exact down.
CREATE TABLE greenfield_backup_acl_reconciliation (
  object_identity TEXT PRIMARY KEY,
  schema_name TEXT NOT NULL,
  object_name TEXT NOT NULL,
  object_kind TEXT NOT NULL CHECK (object_kind IN ('TABLE', 'SEQUENCE')),
  reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO greenfield_backup_acl_reconciliation (
  object_identity,
  schema_name,
  object_name,
  object_kind
)
SELECT
  format('%I.%I', namespace.nspname, relation.relname),
  namespace.nspname,
  relation.relname,
  'TABLE'
FROM pg_class relation
JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relkind IN ('r', 'p')
  AND NOT has_table_privilege(
    'modula_backup',
    format('%I.%I', namespace.nspname, relation.relname),
    'SELECT'
  );

INSERT INTO greenfield_backup_acl_reconciliation (
  object_identity,
  schema_name,
  object_name,
  object_kind
)
SELECT
  format('%I.%I', namespace.nspname, relation.relname),
  namespace.nspname,
  relation.relname,
  'SEQUENCE'
FROM pg_class relation
JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relkind = 'S'
  AND NOT has_sequence_privilege(
    'modula_backup',
    format('%I.%I', namespace.nspname, relation.relname),
    'SELECT'
  );

GRANT USAGE ON SCHEMA public TO modula_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO modula_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO modula_backup;

COMMENT ON TABLE greenfield_backup_acl_reconciliation IS
  'Objects whose backup-role SELECT privilege was added by migration 053; used for exact rollback.';

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '053')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
