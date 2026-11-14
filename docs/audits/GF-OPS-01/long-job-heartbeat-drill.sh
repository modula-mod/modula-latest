#!/usr/bin/env bash
# GF-OPS-01 (c) reproduction / acceptance runner. Creates a disposable database on the
# loopback server, migrates it with the repository's own migrate.ts, then runs
# services/greenfield-worker/tests/worker-liveness.acceptance.test.ts, which spawns the REAL
# worker and blocks one job for ~90 s.
#
# On the current worker runtime this is EXPECTED TO FAIL (exit 1): the heartbeat goes stale,
# the Docker healthcheck reports unhealthy and the 60 s lease expires unrenewed. It must pass
# after Forge's runtime change (README.md, "Forge handoff"). A non-zero exit is never relabelled
# as a pass here.
# Needs: psql, node >= 22, `pnpm install` done (worker node_modules with tsx, vitest, pg).
# Env: GF_OPS01_PG_ADMIN_URL (default loopback 127.0.0.1:55491), GF_OPS01_LOG_DIR, GF_OPS01_REPO,
#      MODULA_WORKER_LIVENESS_JOB_MS (default 90000; below 90000 only with
#      MODULA_WORKER_LIVENESS_CONTROL=1, a harness self-check that is never acceptance evidence).
set -euo pipefail
source "$(dirname "$0")/drill-lib.sh"
gf_ops01_require_loopback
TS=$(date -u +%Y%m%dT%H%M%SZ)
DB="gf_ops01_drill_liveness_$(date +%s)_$$"
URL=$(gf_ops01_db_url "$DB")
WORK=$(mktemp -d "${TMPDIR:-/tmp}/gf-ops-01-liveness.XXXXXX")
mkdir -p "$GF_OPS01_LOG_DIR"
REPORT="$GF_OPS01_LOG_DIR/long-job-heartbeat-$TS.json"
[[ -x "$GF_OPS01_WORKER_DIR/node_modules/.bin/vitest" && -e "$GF_OPS01_WORKER_DIR/node_modules/tsx/dist/cli.mjs" ]] || { echo "worker dependencies missing; run pnpm install" >&2; exit 2; }
cleanup() { gf_ops01_drop_db "$DB"; rm -rf "$WORK"; }
trap cleanup EXIT
echo "START $(date -u '+%Y-%m-%d %H:%M:%S') UTC repo=$(git -C "$GF_OPS01_REPO" rev-parse --short HEAD 2>/dev/null || echo '?')"
gf_ops01_create_db "$DB"
cp "$GF_OPS01_REPO/services/greenfield-api/src/database/migrate.ts" "$WORK/migrate.ts"
ln -s "$GF_OPS01_WORKER_DIR/node_modules" "$WORK/node_modules"
echo '{"type":"module"}' > "$WORK/package.json"
cat > "$WORK/run.ts" <<'TS'
import {migrateUp} from './migrate.ts'
const applied = await migrateUp(process.env.DRILL_URL as string, process.env.DRILL_MIGRATIONS)
console.log(`migrated ${applied.length} (${applied[0]} .. ${applied.at(-1)})`)
TS
DRILL_URL="$URL" DRILL_MIGRATIONS="$GF_OPS01_REPO/services/greenfield-api/migrations" node "$WORK/node_modules/tsx/dist/cli.mjs" "$WORK/run.ts"
set +e
( cd "$GF_OPS01_WORKER_DIR" && MODULA_TEST_DATABASE_URL="$URL" MODULA_WORKER_LIVENESS_ACCEPTANCE=1 MODULA_WORKER_LIVENESS_REPORT="$REPORT" \
  node_modules/.bin/vitest run tests/worker-liveness.acceptance.test.ts ) 2>&1 | sed -e "s#$(gf_ops01_db_url '')#<loopback-db>/#g"
rc=${PIPESTATUS[0]}
set -e
echo "REPORT $REPORT"
if [[ $rc == 0 && ${MODULA_WORKER_LIVENESS_CONTROL:-} == 1 ]]; then echo "RESULT CONTROL PASS (short job, harness self-check only; NOT acceptance evidence)"
elif [[ $rc == 0 ]]; then echo "RESULT PASS: heartbeat, healthcheck and lease stayed alive through the long job"
else echo "RESULT FAIL (exit $rc): worker liveness lost during a long job; expected until Forge lands GF-OPS-01 (c)"; fi
exit "$rc"
