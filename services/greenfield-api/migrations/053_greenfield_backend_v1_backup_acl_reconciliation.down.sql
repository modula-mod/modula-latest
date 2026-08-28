DO $$
DECLARE
  object_record RECORD;
BEGIN
  FOR object_record IN
    SELECT schema_name, object_name, object_kind
    FROM greenfield_backup_acl_reconciliation
    ORDER BY object_kind, object_identity
  LOOP
    IF to_regclass(format('%I.%I', object_record.schema_name, object_record.object_name)) IS NULL THEN
      CONTINUE;
    END IF;

    IF object_record.object_kind = 'TABLE' THEN
      EXECUTE format(
        'REVOKE SELECT ON TABLE %I.%I FROM modula_backup',
        object_record.schema_name,
        object_record.object_name
      );
    ELSE
      EXECUTE format(
        'REVOKE SELECT ON SEQUENCE %I.%I FROM modula_backup',
        object_record.schema_name,
        object_record.object_name
      );
    END IF;
  END LOOP;
END $$;

DROP TABLE greenfield_backup_acl_reconciliation;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '052')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
