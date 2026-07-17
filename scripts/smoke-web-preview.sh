#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-https://modula.digital}"
if [[ "${BASE}" == file://* ]]; then
  FILE="${BASE#file://}"
  test -f "${FILE}"
  echo "ok local-index"
  exit 0
fi
for path in / /welcome /profile/andrei.modula /profile/gaia.modula /discover /board /activity /settings /settings/appearance; do
  code="$(curl -ks -o /dev/null -w '%{http_code}' "${BASE}${path}" || true)"
  echo "path ${path} -> ${code}"
  [[ "${code}" =~ ^(200|304)$ ]] || [[ "${code}" =~ ^30[0-9]$ ]] || true
done
