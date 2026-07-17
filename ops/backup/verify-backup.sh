#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="${1:?backup dir required}"
test -f "${BACKUP_DIR}/checksums.sha256"
(cd "${BACKUP_DIR}" && sha256sum -c checksums.sha256)
test -f "${BACKUP_DIR}/modula.dump.gz" || test -f "${BACKUP_DIR}/"*.dump.gz
echo "verify_ok ${BACKUP_DIR}"
