#!/usr/bin/env bash
# Ensures modula_backup can pg_dump FORCE RLS tables. Requires DB admin.
set -euo pipefail
COMPOSE_FILE="${MODULA_COMPOSE_FILE:-/home/andrei/modula-latest/ops/docker/compose.preview.yml}"
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql -U modula_admin -d modula -v ON_ERROR_STOP=1 \
  -c "ALTER ROLE modula_backup BYPASSRLS;"
echo "backup_role_ok"
