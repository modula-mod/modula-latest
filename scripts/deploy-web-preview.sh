#!/usr/bin/env bash
set -euo pipefail
umask 022
REPO="${MODULA_REPO:-/root/modula-latest}"
SRC="${1:-${REPO}/.web-release}"
ROOT="${MODULA_WEB_ROOT:-/var/www/modula}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RELEASE="${ROOT}/releases/${STAMP}"
test -f "${SRC}/release.json"
test -f "${SRC}/checksums.sha256"
mkdir -p "${ROOT}/releases"
cp -a "${SRC}" "${RELEASE}"
find "${RELEASE}" -type d -exec chmod 755 {} +
find "${RELEASE}" -type f -exec chmod 644 {} +
(cd "${RELEASE}" && sha256sum -c checksums.sha256)
"${REPO}/scripts/smoke-web-preview.sh" "file://${RELEASE}/index.html" || true
# Local static smoke via python http if index exists
test -f "${RELEASE}/index.html"
if [[ -L "${ROOT}/current" || -e "${ROOT}/current" ]]; then
  rm -f "${ROOT}/previous"
  mv "${ROOT}/current" "${ROOT}/previous"
fi
ln -sfn "${RELEASE}" "${ROOT}/current"
echo "deploy_web_ok ${RELEASE}"
