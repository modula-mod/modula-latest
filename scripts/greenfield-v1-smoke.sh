#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---safe}"
REPO="${MODULA_PRODUCTION_CHECKOUT:-/root/modula-latest}"
BASE_URL="${MODULA_HEALTH_BASE_URL:-https://api.modula.digital}"

if [[ "${MODE}" != "--safe" && "${MODE}" != "--full" ]]; then
  echo "usage: greenfield-v1-smoke.sh [--safe|--full]" >&2
  exit 2
fi

if [[ ! -d "${REPO}/.git" && ! -f "${REPO}/.git" ]]; then
  echo "production checkout missing: ${REPO}" >&2
  exit 1
fi

EXPECTED_SHA="$(git -C "${REPO}" rev-parse HEAD)"
MODULA_HEALTH_BASE_URL="${BASE_URL}" MODULA_EXPECTED_RELEASE_SHA="${EXPECTED_SHA}" \
  node "${REPO}/scripts/greenfield-v1-health.mjs" --local

if [[ "${MODE}" == "--safe" ]]; then
  echo "greenfield_v1_safe_smoke_ok sha=${EXPECTED_SHA}"
  exit 0
fi

if [[ -n "$(git -C "${REPO}" status --short)" ]]; then
  echo "full smoke requires a clean production checkout" >&2
  exit 1
fi
if [[ "$(git -C "${REPO}" branch --show-current)" != "main" ]]; then
  echo "full smoke requires production main" >&2
  exit 1
fi
if [[ "${EXPECTED_SHA}" != "$(git -C "${REPO}" rev-parse origin/main)" ]]; then
  echo "full smoke requires HEAD equal to origin/main" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source /etc/modula/api-atlas.env
# shellcheck disable=SC1091
source /etc/modula/greenfield-api.env
set +a

POSTGRES_ADDRESS="$(docker inspect modula-production-greenfield-postgres-1 --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')"
if [[ -z "${POSTGRES_ADDRESS}" ]]; then
  echo "cannot resolve production PostgreSQL container" >&2
  exit 1
fi
MODULA_DATABASE_URL="$(node -e 'const u=new URL(process.argv[1]);u.hostname=process.argv[2];process.stdout.write(u.toString())' "${MODULA_DATABASE_URL}" "${POSTGRES_ADDRESS}")"
MODULA_DATABASE_MIGRATOR_URL="$(node -e 'const u=new URL(process.argv[1]);u.hostname=process.argv[2];process.stdout.write(u.toString())' "${MODULA_DATABASE_MIGRATOR_URL}" "${POSTGRES_ADDRESS}")"
export MODULA_DATABASE_URL MODULA_DATABASE_MIGRATOR_URL
export API_ATLAS_BASE_URL="${BASE_URL}"

node "${REPO}/tools/api-atlas/acceptance.mjs"
CI=true pnpm --dir "${REPO}" --filter @modula/greenfield-api exec tsx scripts/greenfield-v1-integrity.ts
CI=true pnpm --dir "${REPO}" --filter @modula/greenfield-api exec tsx scripts/trust-cutover-gate.ts --file "${REPO}/ops/trust/api-fix-01c-bootstrap.json"

echo "greenfield_v1_full_smoke_ok sha=${EXPECTED_SHA}"
