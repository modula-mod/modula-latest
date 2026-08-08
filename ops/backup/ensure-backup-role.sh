#!/usr/bin/env bash
# Ensures modula_backup can pg_dump FORCE RLS tables. Requires DB admin.
set -euo pipefail
COMPOSE_FILE="${MODULA_COMPOSE_FILE:-/root/modula-latest/ops/docker/compose.preview.yml}"
POSTGRES_SERVICE="${MODULA_POSTGRES_SERVICE:-greenfield-postgres}"
docker compose -f "${COMPOSE_FILE}" exec -T "${POSTGRES_SERVICE}" \
  psql -U modula_admin -d modula -v ON_ERROR_STOP=1 \
  -c "ALTER ROLE modula_backup BYPASSRLS;"
echo "backup_role_ok"
