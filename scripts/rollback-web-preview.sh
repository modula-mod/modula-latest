#!/usr/bin/env bash
set -euo pipefail
ROOT="${MODULA_WEB_ROOT:-/var/www/modula}"
test -e "${ROOT}/previous"
CURRENT="$(readlink -f "${ROOT}/current" || true)"
PREV="$(readlink -f "${ROOT}/previous")"
ln -sfn "${PREV}" "${ROOT}/current"
echo "rollback_web_ok from ${CURRENT} to ${PREV}"
