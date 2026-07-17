DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'modula_backup') THEN
    ALTER ROLE modula_backup NOBYPASSRLS;
  END IF;
END
$$;
