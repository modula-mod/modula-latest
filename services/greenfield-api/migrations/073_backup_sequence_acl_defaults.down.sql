DO $$
DECLARE
  sequence_record RECORD;
  default_select_was_present BOOLEAN;
BEGIN
  SELECT select_was_present
  INTO STRICT default_select_was_present
  FROM greenfield_backup_sequence_acl_reconciliation
  WHERE record_kind = 'DEFAULT';

  IF NOT default_select_was_present THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE modula_migrator IN SCHEMA public
      REVOKE SELECT ON SEQUENCES FROM modula_backup;
  END IF;

  FOR sequence_record IN
    SELECT schema_name, sequence_name
    FROM greenfield_backup_sequence_acl_reconciliation
    WHERE record_kind = 'SEQUENCE'
    ORDER BY record_identity
  LOOP
    IF to_regclass(format('%I.%I', sequence_record.schema_name, sequence_record.sequence_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'REVOKE SELECT ON SEQUENCE %I.%I FROM modula_backup',
      sequence_record.schema_name,
      sequence_record.sequence_name
    );
  END LOOP;
END $$;

DROP TABLE greenfield_backup_sequence_acl_reconciliation;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '072')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
