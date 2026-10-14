-- PostgreSQL logical backups read sequence state as well as table data. Migration
-- 053 reconciled the sequences that existed at that point, but did not install a
-- default sequence ACL, so later sequences could make dedicated-role backups
-- fail. Record the prior state so the down migration can restore it exactly.
CREATE TABLE greenfield_backup_sequence_acl_reconciliation (
  record_identity TEXT PRIMARY KEY,
  record_kind TEXT NOT NULL CHECK (record_kind IN ('SEQUENCE', 'DEFAULT')),
  schema_name TEXT,
  sequence_name TEXT,
  select_was_present BOOLEAN NOT NULL,
  reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT greenfield_backup_sequence_acl_reconciliation_shape CHECK (
    (record_kind = 'SEQUENCE' AND schema_name IS NOT NULL AND sequence_name IS NOT NULL AND NOT select_was_present)
    OR (record_kind = 'DEFAULT' AND schema_name IS NULL AND sequence_name IS NULL)
  )
);

INSERT INTO greenfield_backup_sequence_acl_reconciliation (
  record_identity,
  record_kind,
  schema_name,
  sequence_name,
  select_was_present
)
SELECT
  format('%I.%I', namespace.nspname, relation.relname),
  'SEQUENCE',
  namespace.nspname,
  relation.relname,
  FALSE
FROM pg_class relation
JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relkind = 'S'
  AND NOT has_sequence_privilege(
    'modula_backup',
    format('%I.%I', namespace.nspname, relation.relname),
    'SELECT'
  );

INSERT INTO greenfield_backup_sequence_acl_reconciliation (
  record_identity,
  record_kind,
  select_was_present
)
SELECT
  'default:modula_migrator:public:sequence:modula_backup:select',
  'DEFAULT',
  EXISTS (
  SELECT 1
  FROM pg_default_acl default_acl
  CROSS JOIN LATERAL aclexplode(default_acl.defaclacl) privilege
  WHERE default_acl.defaclrole = 'modula_migrator'::regrole
    AND default_acl.defaclnamespace = 'public'::regnamespace
    AND default_acl.defaclobjtype = 'S'
    AND privilege.grantee = 'modula_backup'::regrole
    AND privilege.privilege_type = 'SELECT'
);

GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO modula_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE modula_migrator IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO modula_backup;

COMMENT ON TABLE greenfield_backup_sequence_acl_reconciliation IS
  'Sequence and default-ACL state changed by migration 073; used for exact rollback.';

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '073')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
