#!/usr/bin/env bash
set -euo pipefail
REPO="${MODULA_REPO:-/home/andrei/modula-latest}"
COMPOSE="${REPO}/ops/docker/compose.preview.yml"
cd "${REPO}"
test -f /etc/modula/api.env
RELEASE_ID="$(git rev-parse HEAD)-$(date -u +%Y%m%dT%H%M%SZ)"
echo "deploy_api_start ${RELEASE_ID}"
docker compose -f "${COMPOSE}" build api
docker compose -f "${COMPOSE}" up -d postgres
# Wait for postgres healthy then migrate/seed using migrator URL from env file
set -a
# shellcheck disable=SC1091
source /etc/modula/api.env
set +a
docker compose -f "${COMPOSE}" run --rm --no-deps \
  -e MODULA_DATABASE_URL="${MODULA_DATABASE_MIGRATOR_URL}" \
  -e MODULA_DATABASE_MIGRATOR_URL="${MODULA_DATABASE_MIGRATOR_URL}" \
  api pnpm --filter @modula/api db:migrate
docker compose -f "${COMPOSE}" run --rm --no-deps \
  -e MODULA_DATABASE_URL="${MODULA_DATABASE_MIGRATOR_URL}" \
  -e MODULA_DATABASE_MIGRATOR_URL="${MODULA_DATABASE_MIGRATOR_URL}" \
  api pnpm --filter @modula/api db:seed
docker compose -f "${COMPOSE}" up -d api
"${REPO}/scripts/smoke-api-preview.sh" http://127.0.0.1:4020
echo "deploy_api_ok ${RELEASE_ID}"
