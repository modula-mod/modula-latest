#!/usr/bin/env bash
# GF-OPS-02 local drill. Loopback disposable PostgreSQL only. No production, no network.
#
# Parameters (all optional; safe defaults):
#   GF_OPS02_REPO           checkout to exercise (default: this script's repository)
#   GF_OPS02_PG_ADMIN_URL   loopback admin URL (default postgres://sentinel@127.0.0.1:55491/postgres);
#                           anything that is not 127.0.0.1/localhost is refused
#   GF_OPS02_LOG_DIR        evidence directory (default ${TMPDIR:-/tmp}/gf-ops-02-drill/logs)
#   GF_OPS02_SCRATCH_DIR    scratch parent, removed per run (default ${TMPDIR:-/tmp}/gf-ops-02-drill)
#   GF_OPS02_NODE_MODULES   node_modules providing `pg` for the migration runner
#                           (default $GF_OPS02_REPO/services/greenfield-api/node_modules)
#   GF_OPS02_AGE_BIN_DIR    directory prepended to PATH to provide `age`/`age-keygen`
# If the resolved `age` is a SENTINEL TEST STUB it is labelled STUB in the output: that exercises
# plumbing (headers, digests, signatures, transport, restore), not age cryptography.
set -euo pipefail
REPO=${GF_OPS02_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}
ADMIN=${GF_OPS02_PG_ADMIN_URL:-postgres://sentinel@127.0.0.1:55491/postgres}
LOG=${GF_OPS02_LOG_DIR:-${TMPDIR:-/tmp}/gf-ops-02-drill/logs}
SCRATCH_PARENT=${GF_OPS02_SCRATCH_DIR:-${TMPDIR:-/tmp}/gf-ops-02-drill}
NODE_MODULES=${GF_OPS02_NODE_MODULES:-$REPO/services/greenfield-api/node_modules}
[[ -n "${GF_OPS02_AGE_BIN_DIR:-}" ]] && export PATH="$GF_OPS02_AGE_BIN_DIR:$PATH"
case "$ADMIN" in
  postgres://*@127.0.0.1:*/*|postgresql://*@127.0.0.1:*/*|postgres://*@localhost:*/*|postgresql://*@localhost:*/*) ;;
  *) echo "REFUSING: GF_OPS02_PG_ADMIN_URL must point at a loopback disposable server" >&2; exit 2 ;;
esac
db_url() { printf '%s/%s' "${ADMIN%/*}" "$1"; }
[[ -d "$NODE_MODULES/pg" ]] || { echo "pg not found under GF_OPS02_NODE_MODULES=$NODE_MODULES" >&2; exit 2; }
command -v age >/dev/null && command -v age-keygen >/dev/null || { echo "age/age-keygen not on PATH (set GF_OPS02_AGE_BIN_DIR)" >&2; exit 2; }
AGE_KIND=real; grep -q "TEST STUB" "$(command -v age)" 2>/dev/null && AGE_KIND=STUB
WT=$REPO
TS=$(date -u +%Y%m%dT%H%M%S)
SCR=$SCRATCH_PARENT/$TS
SRC_DB="gf_ops02_drill_src_${TS,,}"; RST_DB="gf_ops02_drill_restore_${TS,,}"; RST2_DB="gf_ops02_drill_restore2_${TS,,}"
case "$SRC_DB$RST_DB" in *mosaic*|*synapse*) echo REFUSING; exit 2;; esac
mkdir -p "$SCR" "$LOG" && chmod 700 "$SCR"
# The restore drill only stages strictly inside MODULA_RESTORE_DRILL_ROOT (resolved-path containment).
export MODULA_RESTORE_DRILL_ROOT="$SCR/restore-drill"
mkdir -p "$MODULA_RESTORE_DRILL_ROOT" && chmod 700 "$MODULA_RESTORE_DRILL_ROOT"
cleanup() { for d in "$SRC_DB" "$RST_DB" "$RST2_DB"; do psql -q "$ADMIN" -c "DROP DATABASE IF EXISTS $d" || true; done; rm -rf "$SCR"; }
trap cleanup EXIT
echo "START $(date -u '+%Y-%m-%d %H:%M:%S') GMT ts=$TS repo=$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo '?') age=$(command -v age) ($AGE_KIND)"
for d in "$SRC_DB" "$RST_DB" "$RST2_DB"; do psql -q "$ADMIN" -c "CREATE DATABASE $d"; done

# 1. migrate source with the checkout's own runner (migrate.ts via Node type stripping)
mkdir -p "$SCR/runner" && cp "$WT/services/greenfield-api/src/database/migrate.ts" "$SCR/runner/migrate.ts"
ln -s "$NODE_MODULES" "$SCR/runner/node_modules"
cat > "$SCR/runner/run.mjs" <<'JS'
import {migrateUp} from './migrate.ts'
const applied = await migrateUp(process.env.DRILL_SRC_URL, process.env.DRILL_MIGRATIONS)
console.log(`migrated ${applied.length} (${applied[0]} .. ${applied.at(-1)})`)
JS
DRILL_SRC_URL="$(db_url "$SRC_DB")" DRILL_MIGRATIONS="$WT/services/greenfield-api/migrations" node --no-warnings "$SCR/runner/run.mjs"

# 2. synthetic fixture data (test-only content) + media fixture
psql -q -v ON_ERROR_STOP=1 "$(db_url "$SRC_DB")" <<'SQL'
CREATE TABLE sentinel_drill_fixture (id int PRIMARY KEY, body text NOT NULL, payload bytea NOT NULL);
INSERT INTO sentinel_drill_fixture SELECT g, 'test.modula.drill row ' || g, decode(md5(g::text), 'hex') FROM generate_series(1, 5000) g;
GRANT SELECT ON sentinel_drill_fixture TO modula_api;
INSERT INTO greenfield_worker_heartbeats VALUES ('drill-worker-1', repeat('a',40), now(), now()), ('drill-worker-2', repeat('b',40), now(), now());
SQL
mkdir -p "$SCR/media-src/nested/deeper" "$SCR/restore-media" "$SCR/restore2-media"
head -c 200000 /dev/urandom > "$SCR/media-src/nested/blob.bin"; echo '{"fixture":"test.modula.drill"}' > "$SCR/media-src/nested/deeper/metadata.json"; echo hello > "$SCR/media-src/a.txt"
chmod 700 "$SCR/restore-media" "$SCR/restore2-media"

# 3. ephemeral keys (stub identity + HMAC key), never logged
age-keygen -o "$SCR/identity.txt" 2>/dev/null; chmod 600 "$SCR/identity.txt"
export MODULA_RECOVERY_AGE_RECIPIENT=$(grep -o 'age1[0-9a-z]*' "$SCR/identity.txt" | head -1)
export MODULA_RECOVERY_AGE_IDENTITY_FILE="$SCR/identity.txt"
export MODULA_RECOVERY_SIGNING_KEY=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
export MODULA_RECOVERY_SIGNING_KEY_ID=gf-ops-02-local-drill
export DRILL_SRC_URL="$(db_url "$SRC_DB")" DRILL_RST_URL="$(db_url "$RST_DB")" DRILL_RST2_URL="$(db_url "$RST2_DB")"
export DRILL_SRC_MEDIA="$SCR/media-src" DRILL_RST_MEDIA="$SCR/restore-media" DRILL_RST2_MEDIA="$SCR/restore2-media"
cat > "$SCR/recovery.json" <<JSON
{"version":1,"sourceRevision":"$(git -C "$REPO" rev-parse HEAD 2>/dev/null || echo 0000000000000000000000000000000000000000)","databases":[{"id":"greenfield-core","role":"GREENFIELD_CORE","urlEnv":"DRILL_SRC_URL"}],"assets":[{"id":"greenfield-media","role":"MANAGED_ASSETS","pathEnv":"DRILL_SRC_MEDIA"}]}
JSON
mk_targets() { cat > "$1" <<JSON
{"version":1,"databases":[{"id":"greenfield-core","urlEnv":"$2","checks":[{"name":"fixture-rows","sql":"SELECT count(*) FROM sentinel_drill_fixture","expect":"5000"}]}],"assets":[{"id":"greenfield-media","pathEnv":"$3"}]}
JSON
}
mk_targets "$SCR/targets.json" DRILL_RST_URL DRILL_RST_MEDIA
mk_targets "$SCR/targets2.json" DRILL_RST2_URL DRILL_RST2_MEDIA

# 4. on-host encrypted backup with the real recovery tool
mkdir -p "$SCR/onhost" && chmod 700 "$SCR/onhost"
node "$WT/ops/backup/greenfield-backend-v1-recovery.mjs" backup --config "$SCR/recovery.json" --output-root "$SCR/onhost" | tail -1 | tee "$LOG/step4-backup.json"
SET=$(ls "$SCR/onhost" | grep '^gbv1-recovery-' | head -1); echo "SET=$SET"
node "$WT/ops/backup/greenfield-backend-v1-recovery.mjs" verify --config "$SCR/recovery.json" --backup-dir "$SCR/onhost/$SET" | tee "$LOG/step4-verify.json"

# 5. off-host copy to a local fake remote: disabled default, dry-run, then push
export MODULA_OFFHOST_BACKUP_TARGET="file://$SCR/offhost-fake-remote/greenfield-v1"
env -u MODULA_OFFHOST_BACKUP_ENABLED node "$WT/ops/backup/greenfield-v1-offhost.mjs" push --backup-dir "$SCR/onhost/$SET" | tee "$LOG/step5a-disabled.json"
[[ ! -e "$SCR/offhost-fake-remote" ]] && echo "PASS disabled-by-default wrote nothing"
MODULA_OFFHOST_BACKUP_ENABLED=1 node "$WT/ops/backup/greenfield-v1-offhost.mjs" push --dry-run --backup-dir "$SCR/onhost/$SET" | tee "$LOG/step5b-dryrun.json"
[[ ! -e "$SCR/offhost-fake-remote" ]] && echo "PASS dry-run wrote nothing"
MODULA_OFFHOST_BACKUP_ENABLED=1 node "$WT/ops/backup/greenfield-v1-offhost.mjs" push --backup-dir "$SCR/onhost/$SET" | tee "$LOG/step5c-push.json"
MODULA_OFFHOST_BACKUP_ENABLED=1 node "$WT/ops/backup/greenfield-v1-offhost.mjs" list | tee "$LOG/step5d-list.json"
( cd "$SCR/offhost-fake-remote/greenfield-v1" && find . -type f | sort | xargs sha256sum ) > "$LOG/step5e-offhost-sha256.txt"
if grep -l -a "test.modula.drill row" -r "$SCR/offhost-fake-remote" >/dev/null 2>&1; then echo "FAIL plaintext fixture found off-host"; exit 1; else echo "PASS no plaintext fixture rows in off-host copy"; fi

# 6. simulate host loss: remove the on-host set, then restore drill from off-host into disposable DB
rm -rf "$SCR/onhost/$SET"
set +e
node "$WT/ops/backup/greenfield-v1-restore-drill.mjs" --set "$SET" --staging "$MODULA_RESTORE_DRILL_ROOT/stage" --config "$SCR/recovery.json" --targets "$SCR/targets.json" --compare-url-env DRILL_SRC_URL --report "$LOG/step6-restore-drill-report.json" > /dev/null
rc6=$?
echo "step6 restore drill rc=$rc6"; node -e 'const r=require(process.argv[1]);for(const c of r.checks)console.log((c.ok?"PASS ":"FAIL ")+c.name+"  "+c.detail)' "$LOG/step6-restore-drill-report.json"
diff <(cd "$DRILL_SRC_MEDIA" && find . -type f | sort | xargs sha256sum) <(cd "$DRILL_RST_MEDIA" && find . -type f | sort | xargs sha256sum) && echo "PASS restored media sha256 identical"

# 7. negative: tamper one off-host ciphertext byte, drill must fail closed and leave the target DB empty
P="$SCR/offhost-fake-remote/greenfield-v1/$SET/payloads/database-greenfield-core.dump.age"
printf '\x00' | dd of="$P" bs=1 seek=100 conv=notrunc status=none
node "$WT/ops/backup/greenfield-v1-restore-drill.mjs" --set "$SET" --staging "$MODULA_RESTORE_DRILL_ROOT/stage2" --config "$SCR/recovery.json" --targets "$SCR/targets2.json" --report "$LOG/step7-tamper-report.json" > /dev/null
rc7=$?
echo "step7 tampered drill rc=$rc7 (expect 1)"; node -e 'const r=require(process.argv[1]);for(const c of r.checks)console.log((c.ok?"PASS ":"FAIL ")+c.name+"  "+c.detail)' "$LOG/step7-tamper-report.json"
echo "step7 restore2 tables: $(psql -At "$DRILL_RST2_URL" -c "SELECT count(*) FROM pg_tables WHERE schemaname='public'")"
set -e
echo "END $(date -u '+%Y-%m-%d %H:%M:%S') GMT"
[[ $rc6 == 0 && $rc7 == 1 ]]
