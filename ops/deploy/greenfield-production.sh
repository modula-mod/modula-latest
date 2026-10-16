#!/usr/bin/env bash
set -Eeuo pipefail

CHECKOUT="${MODULA_PRODUCTION_CHECKOUT:-/root/modula-latest}"
LOCK_FILE="${MODULA_DEPLOY_LOCK_FILE:-/run/lock/modula-greenfield-deploy.lock}"
RECOVERY_ENV_FILE="${MODULA_RECOVERY_ENV_FILE:-/etc/modula/greenfield-platform-recovery.env}"
BACKUP_MARKER="${MODULA_BACKUP_SUCCESS_MARKER:-}"
BASE_URL="${MODULA_HEALTH_BASE_URL:-https://api.modula.digital}"
COMPOSE_FILE="${CHECKOUT}/ops/docker/compose.production.yml"
SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXPECTED_SHA=""
EXPECTED_MIGRATION=""
CHECK_LOCK_ONLY=false
DEPLOY_PHASE="argument-validation"
PREVIOUS_SHA="unknown"

usage() {
  echo "usage: greenfield-production.sh --expected-sha <40-hex> --expected-migration <migration-id>" >&2
  echo "       greenfield-production.sh --check-lock-only" >&2
}

wait_for_endpoint() {
  local url=$1
  local timeout_seconds=$2
  local deadline=$((SECONDS + timeout_seconds))
  while (( SECONDS < deadline )); do
    if curl --fail --silent --show-error --max-time 5 -H "x-request-id: deploy-${EXPECTED_SHA:0:12}" "${url}" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  echo "endpoint did not become healthy within ${timeout_seconds}s: ${url}" >&2
  return 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --expected-sha)
      [[ $# -ge 2 ]] || { usage; exit 2; }
      EXPECTED_SHA="$2"
      shift 2
      ;;
    --expected-migration)
      [[ $# -ge 2 ]] || { usage; exit 2; }
      EXPECTED_MIGRATION="$2"
      shift 2
      ;;
    --check-lock-only)
      CHECK_LOCK_ONLY=true
      shift
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

mkdir -p "$(dirname "${LOCK_FILE}")"
exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "deployment refused: another GreenField deployment holds ${LOCK_FILE}" >&2
  exit 75
fi

if [[ "${CHECK_LOCK_ONLY}" == true ]]; then
  if [[ -n "${MODULA_DEPLOY_LOCK_HOLD_SECONDS:-}" ]]; then
    sleep "${MODULA_DEPLOY_LOCK_HOLD_SECONDS}"
  fi
  echo "greenfield_deployment_lock_ok lock=${LOCK_FILE}"
  exit 0
fi

if [[ ! "${EXPECTED_SHA}" =~ ^[0-9a-f]{40}$ ]] || [[ ! "${EXPECTED_MIGRATION}" =~ ^[0-9]{3}_[a-z0-9_]+$ ]]; then
  usage
  exit 2
fi
if [[ "$(id -u)" -ne 0 ]]; then
  echo "production deployment requires root" >&2
  exit 1
fi
if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "production compose file missing: ${COMPOSE_FILE}" >&2
  exit 1
fi
if [[ ! -f "${RECOVERY_ENV_FILE}" ]]; then
  echo "production recovery environment is missing: ${RECOVERY_ENV_FILE}" >&2
  exit 1
fi
if [[ -z "${BACKUP_MARKER}" ]]; then
  RECOVERY_OUTPUT_ROOT="$(awk -F= '$1 == "MODULA_RECOVERY_OUTPUT_ROOT" {sub(/^[^=]*=/, ""); gsub(/^[[:space:]"'\'' ]+|[[:space:]"'\'' ]+$/, ""); print; exit}' "${RECOVERY_ENV_FILE}")"
  BACKUP_MARKER="${RECOVERY_OUTPUT_ROOT:-/var/backups/modula/greenfield-v1}/last-success.json"
fi

on_exit() {
  local status=$?
  if [[ ${status} -ne 0 ]]; then
    echo "deployment failed phase=${DEPLOY_PHASE} previous_sha=${PREVIOUS_SHA} target_sha=${EXPECTED_SHA}" >&2
    echo "do not run a down migration; use the documented forward-DB or backup/restore recovery path" >&2
  fi
}
trap on_exit EXIT

DEPLOY_PHASE="source-preflight"
[[ "$(git -C "${CHECKOUT}" branch --show-current)" == "main" ]] || { echo "production checkout must be on main" >&2; exit 1; }
[[ -z "$(git -C "${CHECKOUT}" status --short)" ]] || { echo "production checkout must be clean" >&2; exit 1; }
PREVIOUS_SHA="$(git -C "${CHECKOUT}" rev-parse HEAD)"
git -C "${CHECKOUT}" fetch origin --prune --tags
ORIGIN_MAIN="$(git -C "${CHECKOUT}" rev-parse origin/main)"
[[ "${ORIGIN_MAIN}" == "${EXPECTED_SHA}" ]] || { echo "expected SHA does not equal origin/main" >&2; exit 1; }
git -C "${CHECKOUT}" merge-base --is-ancestor "${PREVIOUS_SHA}" "${EXPECTED_SHA}" || { echo "target is not a fast-forward descendant of production" >&2; exit 1; }

for service in api worker; do
  image="modula-greenfield-${service}:${PREVIOUS_SHA}"
  docker image inspect "${image}" >/dev/null
  revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "${image}")"
  [[ "${revision}" == "${PREVIOUS_SHA}" ]] || { echo "prior ${service} image has incorrect revision label" >&2; exit 1; }
done

DEPLOY_PHASE="pre-deploy-backup"
BACKUP_RUNNER="${MODULA_DEPLOY_BACKUP_RUNNER:-${SCRIPT_ROOT}/ops/backup/greenfield-v1-backup.mjs}"
[[ -f "${BACKUP_RUNNER}" ]] || { echo "backup runner missing: ${BACKUP_RUNNER}" >&2; exit 1; }
(
  set -a
  # shellcheck disable=SC1090
  source "${RECOVERY_ENV_FILE}"
  set +a
  MODULA_BACKUP_EXPECTED_SOURCE_SHA="${PREVIOUS_SHA}" \
    exec flock -n /run/lock/modula-greenfield-backup.lock node "${BACKUP_RUNNER}"
)
node -e '
  const fs = require("node:fs");
  const [path, expected] = process.argv.slice(1);
  const marker = JSON.parse(fs.readFileSync(path, "utf8"));
  const age = Date.now() - Date.parse(marker.completedAt);
  if (marker.sourceRevision !== expected || !(age >= 0 && age <= 10 * 60 * 1000)) process.exit(1);
' "${BACKUP_MARKER}" "${PREVIOUS_SHA}" || { echo "fresh verified pre-deploy backup marker is missing or stale" >&2; exit 1; }

DEPLOY_PHASE="checkout-fast-forward"
git -C "${CHECKOUT}" merge --ff-only "${EXPECTED_SHA}"
[[ "$(git -C "${CHECKOUT}" rev-parse HEAD)" == "${EXPECTED_SHA}" ]] || { echo "checkout did not reach expected SHA" >&2; exit 1; }
[[ -z "$(git -C "${CHECKOUT}" status --short)" ]] || { echo "checkout became dirty" >&2; exit 1; }

export SOURCE_RELEASE_SHA="${EXPECTED_SHA}"
export SOURCE_BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export SOURCE_RELEASE_ID="greenfield-v1-${EXPECTED_SHA:0:12}"
export SOURCE_EXPECTED_MIGRATION="${EXPECTED_MIGRATION}"

DEPLOY_PHASE="image-build"
docker compose -f "${COMPOSE_FILE}" build --pull=false greenfield-api greenfield-worker
for service in api worker; do
  image="modula-greenfield-${service}:${EXPECTED_SHA}"
  revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "${image}")"
  migration="$(docker image inspect --format '{{ index .Config.Labels "org.modula.migration.expected" }}' "${image}")"
  [[ "${revision}" == "${EXPECTED_SHA}" && "${migration}" == "${EXPECTED_MIGRATION}" ]] || {
    echo "candidate ${service} image identity mismatch" >&2
    exit 1
  }
done

DEPLOY_PHASE="migration"
docker compose -f "${COMPOSE_FILE}" run --rm --no-deps greenfield-api \
  node dist/scripts/db-migrate.js
MIGRATION_STATUS="$(docker compose -f "${COMPOSE_FILE}" run --rm --no-deps greenfield-api node dist/scripts/db-status.js)"
node -e '
  let value = "";
  process.stdin.on("data", chunk => { value += chunk; });
  process.stdin.on("end", () => {
    const status = JSON.parse(value);
    if (status.pending?.length || status.unknown?.length || status.applied?.at(-1) !== process.argv[1]) process.exit(1);
  });
' "${EXPECTED_MIGRATION}" <<<"${MIGRATION_STATUS}" || { echo "migration ledger does not match target" >&2; exit 1; }

DEPLOY_PHASE="api-cutover"
docker compose -f "${COMPOSE_FILE}" up -d --no-deps greenfield-api
wait_for_endpoint "http://127.0.0.1:4020/v1/health/ready" 90

DEPLOY_PHASE="worker-cutover"
docker compose -f "${COMPOSE_FILE}" up -d --no-deps greenfield-worker
wait_for_endpoint "http://127.0.0.1:4020/v1/status" 90

DEPLOY_PHASE="post-deploy-verification"
install -m 0644 "${CHECKOUT}/ops/systemd/modula-greenfield-backup.service" /etc/systemd/system/modula-greenfield-backup.service
install -m 0644 "${CHECKOUT}/ops/systemd/modula-greenfield-backup.timer" /etc/systemd/system/modula-greenfield-backup.timer
systemctl daemon-reload
systemctl enable --now modula-greenfield-backup.timer
nginx -t
MODULA_HEALTH_BASE_URL="${BASE_URL}" \
MODULA_EXPECTED_RELEASE_SHA="${EXPECTED_SHA}" \
MODULA_BACKUP_SUCCESS_MARKER="${BACKUP_MARKER}" \
  node "${CHECKOUT}/scripts/greenfield-v1-health.mjs" --local
MODULA_HEALTH_BASE_URL="${BASE_URL}" MODULA_BACKUP_SUCCESS_MARKER="${BACKUP_MARKER}" \
  "${CHECKOUT}/scripts/greenfield-v1-smoke.sh" --full

for service in api worker; do
  container="modula-production-greenfield-${service}-1"
  revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "${container}")"
  [[ "${revision}" == "${EXPECTED_SHA}" ]] || { echo "running ${service} revision mismatch" >&2; exit 1; }
done

DEPLOY_PHASE="complete"
echo "greenfield_production_deploy_ok previous_sha=${PREVIOUS_SHA} deployed_sha=${EXPECTED_SHA} migration=${EXPECTED_MIGRATION}"
