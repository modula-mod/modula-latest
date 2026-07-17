#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="${1:?backup dir required}"
RESTORE_DB_URL="${MODULA_RESTORE_TEST_DATABASE_URL:?}"
DUMP="$(ls "${BACKUP_DIR}"/modula.dump.gz 2>/dev/null | head -1)"
test -n "${DUMP}"
TMP="$(mktemp)"
gunzip -c "${DUMP}" > "${TMP}"
pg_restore --clean --if-exists --no-owner --dbname "${RESTORE_DB_URL}" "${TMP}"
rm -f "${TMP}"
echo "restore_test_ok"
