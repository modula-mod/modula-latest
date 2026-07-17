#!/usr/bin/env bash
set -euo pipefail
REPO="${MODULA_REPO:-/home/andrei/modula-latest}"
COMPOSE="${REPO}/ops/docker/compose.preview.yml"
cd "${REPO}"
# Prefer Greenfield env files; fall back to legacy paths during transition.
ENV_FILE="/etc/modula/greenfield-api.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  ENV_FILE="/etc/modula/api.env"
fi
test -f "${ENV_FILE}"
RELEASE_ID="$(git rev-parse HEAD)-$(date -u +%Y%m%dT%H%M%SZ)"
echo "deploy_greenfield_api_start ${RELEASE_ID}"
docker compose -f "${COMPOSE}" build greenfield-api
docker compose -f "${COMPOSE}" up -d greenfield-postgres
# Wait for postgres healthy then migrate/seed using migrator URL from env file
set -a
# shellcheck disable=SC1091
source "${ENV_FILE}"
set +a
docker compose -f "${COMPOSE}" run --rm --no-deps \
  -e MODULA_DATABASE_URL="${MODULA_DATABASE_MIGRATOR_URL}" \
  -e MODULA_DATABASE_MIGRATOR_URL="${MODULA_DATABASE_MIGRATOR_URL}" \
  greenfield-api pnpm --filter @modula/greenfield-api db:migrate
docker compose -f "${COMPOSE}" run --rm --no-deps \
  -e MODULA_DATABASE_URL="${MODULA_DATABASE_MIGRATOR_URL}" \
  -e MODULA_DATABASE_MIGRATOR_URL="${MODULA_DATABASE_MIGRATOR_URL}" \
  greenfield-api pnpm --filter @modula/greenfield-api db:seed
docker compose -f "${COMPOSE}" up -d greenfield-api
"${REPO}/scripts/smoke-api-preview.sh" http://127.0.0.1:4020
echo "deploy_greenfield_api_ok ${RELEASE_ID}"
