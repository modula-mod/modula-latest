#!/bin/bash
set -euo pipefail
: "${MODULA_MIGRATOR_PASSWORD:?}"
: "${MODULA_API_PASSWORD:?}"
: "${MODULA_READONLY_PASSWORD:?}"
: "${MODULA_BACKUP_PASSWORD:?}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'modula_migrator') THEN
    CREATE ROLE modula_migrator LOGIN PASSWORD '${MODULA_MIGRATOR_PASSWORD}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'modula_api') THEN
    CREATE ROLE modula_api LOGIN PASSWORD '${MODULA_API_PASSWORD}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'modula_readonly') THEN
    CREATE ROLE modula_readonly LOGIN PASSWORD '${MODULA_READONLY_PASSWORD}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'modula_backup') THEN
    CREATE ROLE modula_backup LOGIN PASSWORD '${MODULA_BACKUP_PASSWORD}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'modula_worker') THEN
    CREATE ROLE modula_worker LOGIN PASSWORD '${MODULA_API_PASSWORD}';
  END IF;
END
\$\$;

ALTER ROLE modula_migrator NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
ALTER ROLE modula_api NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER ROLE modula_readonly NOSUPERUSER NOCREATEDB NOCREATEROLE;
# Backup must read FORCE RLS tables (e.g. post_saves) for pg_dump.
ALTER ROLE modula_backup NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
ALTER ROLE modula_worker NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO modula_migrator, modula_api, modula_readonly, modula_backup, modula_worker;
GRANT ALL ON SCHEMA public TO modula_migrator;
GRANT CREATE ON SCHEMA public TO modula_migrator;
ALTER DATABASE ${POSTGRES_DB} OWNER TO modula_migrator;
SQL
