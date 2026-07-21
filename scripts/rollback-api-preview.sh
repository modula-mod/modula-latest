#!/usr/bin/env bash
set -euo pipefail
REPO="${MODULA_REPO:-/home/andrei/modula-latest}"
COMPOSE="${REPO}/ops/docker/compose.preview.yml"
IMAGE_REF="${1:?image digest or tag required}"
docker compose -f "${COMPOSE}" up -d --no-deps greenfield-api
echo "rollback requested for ${IMAGE_REF}; ensure previous image tag is available locally"
"${REPO}/scripts/smoke-api-preview.sh" http://127.0.0.1:4020
