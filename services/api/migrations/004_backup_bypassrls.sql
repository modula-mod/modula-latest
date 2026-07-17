-- Backup role must bypass FORCE RLS so pg_dump can COPY all tables.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'modula_backup') THEN
    ALTER ROLE modula_backup BYPASSRLS;
  END IF;
END
$$;
