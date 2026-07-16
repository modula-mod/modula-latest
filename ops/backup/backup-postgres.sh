#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${MODULA_BACKUP_ROOT:-/home/andrei/backups/modula-postgres}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${ROOT_DIR}/${STAMP}"
COMPOSE_FILE="${MODULA_COMPOSE_FILE:-/home/andrei/modula-latest/ops/docker/compose.preview.yml}"
mkdir -p "${OUT_DIR}"

if [[ ! -f /etc/modula/api.env ]]; then
  echo "missing /etc/modula/api.env" >&2
  exit 1
fi
# shellcheck disable=SC1091
set -a
source /etc/modula/api.env
set +a

: "${MODULA_BACKUP_DATABASE_URL:?MODULA_BACKUP_DATABASE_URL required}"

DUMP_FILE="${OUT_DIR}/modula.dump"
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  pg_dump --format=custom --no-owner --no-privileges \
  "postgresql://modula_backup@localhost/modula" > "${DUMP_FILE}" 2>/dev/null || \
  pg_dump --format=custom --no-owner --no-privileges "${MODULA_BACKUP_DATABASE_URL}" > "${DUMP_FILE}"

gzip -9 "${DUMP_FILE}"
sha256sum "${DUMP_FILE}.gz" > "${OUT_DIR}/checksums.sha256"
echo "${STAMP}" > "${OUT_DIR}/release-id.txt"
find "${ROOT_DIR}" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
echo "backup_ok ${OUT_DIR}"
