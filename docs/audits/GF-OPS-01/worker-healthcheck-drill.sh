#!/usr/bin/env bash
# GF-OPS-01 local drill: ops/docker/greenfield-worker-heartbeat-healthcheck.cjs against a
# disposable database holding the real greenfield_worker_heartbeats DDL (migration 062).
# Includes the #174 (b) case: two worker ids on the same release, one stale; the stale one
# must be unhealthy even though the other heartbeats. Needs psql, node, and the pg driver
# resolvable from services/greenfield-worker (pnpm install).
# Env: GF_OPS01_PG_ADMIN_URL (default loopback 127.0.0.1:55491), GF_OPS01_LOG_DIR, GF_OPS01_REPO.
set -uo pipefail
source "$(dirname "$0")/drill-lib.sh"
gf_ops01_require_loopback
DB="gf_ops01_drill_hc_$(date +%s)_$$"
URL=$(gf_ops01_db_url "$DB")
SHA=$(printf 'b%.0s' {1..40}); OTHER_SHA=$(printf 'c%.0s' {1..40})
gf_ops01_create_db "$DB" || exit 1
trap 'gf_ops01_drop_db "$DB"' EXIT
sed -n '/^CREATE TABLE IF NOT EXISTS greenfield_worker_heartbeats/,/^CREATE INDEX IF NOT EXISTS greenfield_worker_heartbeats_seen_idx/p' \
  "$GF_OPS01_REPO/services/greenfield-api/migrations/062_public_status_support_cases.sql" | psql -q -v ON_ERROR_STOP=1 "$URL" || exit 1
HC=(node "$GF_OPS01_REPO/ops/docker/greenfield-worker-heartbeat-healthcheck.cjs")
export MODULA_HEALTHCHECK_APP_ROOT="$GF_OPS01_WORKER_DIR/"
export MODULA_HEALTHCHECK_CONTAINER_STARTED_AT="$(date -u -d '-120 seconds' +%Y-%m-%dT%H:%M:%SZ)"
pass=0; fail=0
expect() {
  local want=$1 label=$2; shift 2
  out=$("$@" 2>&1); rc=$?
  if [[ $rc == "$want" ]]; then pass=$((pass+1)); r=PASS; else fail=$((fail+1)); r=FAIL; fi
  echo "$r [$label] rc=$rc want=$want :: $out"
  if grep -q "$(gf_ops01_db_url '')\|127.0.0.1:[0-9]*/" <<<"$out"; then echo "FAIL [$label] output leaked connection details"; fail=$((fail+1)); fi
}
q() { psql -q -v ON_ERROR_STOP=1 "$URL" -c "$1"; }
HCENV=(env MODULA_DATABASE_URL="$URL" MODULA_RELEASE_SHA="$SHA")
expect 1 "missing MODULA_DATABASE_URL" env -u MODULA_DATABASE_URL MODULA_WORKER_ID=w MODULA_RELEASE_SHA="$SHA" "${HC[@]}"
expect 1 "missing MODULA_WORKER_ID (fail closed, no any-worker fallback)" env -u MODULA_WORKER_ID MODULA_DATABASE_URL="$URL" MODULA_RELEASE_SHA="$SHA" "${HC[@]}"
expect 1 "missing MODULA_RELEASE_SHA (fail closed)" env MODULA_DATABASE_URL="$URL" MODULA_WORKER_ID=worker-a "${HC[@]}"
expect 1 "no heartbeat rows" "${HCENV[@]}" MODULA_WORKER_ID=worker-a "${HC[@]}"
q "INSERT INTO greenfield_worker_heartbeats VALUES ('worker-a','$SHA', now() - interval '60 seconds', now() - interval '5 seconds')"
expect 0 "fresh heartbeat, matching worker id + release, started after container" "${HCENV[@]}" MODULA_WORKER_ID=worker-a "${HC[@]}"
expect 1 "fresh heartbeat but other release" env MODULA_DATABASE_URL="$URL" MODULA_RELEASE_SHA="$OTHER_SHA" MODULA_WORKER_ID=worker-a "${HC[@]}"
expect 1 "other MODULA_WORKER_ID with no row" "${HCENV[@]}" MODULA_WORKER_ID=worker-z "${HC[@]}"
# (b) two workers on the same release, one stale: the stale one must be unhealthy.
q "INSERT INTO greenfield_worker_heartbeats VALUES ('worker-b','$SHA', now() - interval '300 seconds', now() - interval '200 seconds')"
expect 1 "(b) two worker ids, worker-b stale (200s) while worker-a fresh -> worker-b UNHEALTHY" "${HCENV[@]}" MODULA_WORKER_ID=worker-b "${HC[@]}"
expect 0 "(b) two worker ids, worker-a fresh while worker-b stale -> worker-a healthy" "${HCENV[@]}" MODULA_WORKER_ID=worker-a "${HC[@]}"
q "UPDATE greenfield_worker_heartbeats SET started_at = now() - interval '10 seconds', last_seen_at = now() - interval '200 seconds' WHERE worker_id = 'worker-b'"
expect 1 "(b) stale worker-b started after container, other worker fresh -> worker-b UNHEALTHY" "${HCENV[@]}" MODULA_WORKER_ID=worker-b "${HC[@]}"
expect 1 "heartbeat from a previous container of the same id (started before this container)" "${HCENV[@]}" MODULA_WORKER_ID=worker-a MODULA_HEALTHCHECK_CONTAINER_STARTED_AT="$(date -u -d '+30 seconds' +%Y-%m-%dT%H:%M:%SZ)" "${HC[@]}"
q "UPDATE greenfield_worker_heartbeats SET last_seen_at = now() - interval '200 seconds' WHERE worker_id = 'worker-a'"
expect 1 "stale heartbeat (200s > 90s)" "${HCENV[@]}" MODULA_WORKER_ID=worker-a "${HC[@]}"
expect 0 "stale heartbeat within raised threshold" "${HCENV[@]}" MODULA_WORKER_ID=worker-a MODULA_WORKER_HEALTHCHECK_MAX_AGE_SECONDS=300 "${HC[@]}"
expect 1 "database unreachable (closed port 127.0.0.1:1)" env MODULA_DATABASE_URL="postgres://drill:not-a-secret@127.0.0.1:1/x" MODULA_RELEASE_SHA="$SHA" MODULA_WORKER_ID=worker-a "${HC[@]}"
expect 1 "pg not resolvable" "${HCENV[@]}" MODULA_WORKER_ID=worker-a MODULA_HEALTHCHECK_APP_ROOT=/nonexistent/ "${HC[@]}"
q "UPDATE greenfield_worker_heartbeats SET started_at = now(), last_seen_at = now() WHERE worker_id = 'worker-a'"
expect 0 "/proc/1 start-time path" env -u MODULA_HEALTHCHECK_CONTAINER_STARTED_AT MODULA_DATABASE_URL="$URL" MODULA_RELEASE_SHA="$SHA" MODULA_WORKER_ID=worker-a "${HC[@]}"
echo "RESULT pass=$pass fail=$fail (database dropped on exit)"
[[ $fail == 0 ]]
