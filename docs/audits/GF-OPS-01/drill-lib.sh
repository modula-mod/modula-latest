# Shared helpers for the GF-OPS-01 local drills. Sourced, not executed.
# Disposable PostgreSQL only: the admin URL must point at loopback, and every database the
# drills create is prefixed gf_ops01_drill_ and dropped on exit.
GF_OPS01_REPO=${GF_OPS01_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}
GF_OPS01_PG_ADMIN_URL=${GF_OPS01_PG_ADMIN_URL:-postgres://sentinel@127.0.0.1:55491/postgres}
GF_OPS01_LOG_DIR=${GF_OPS01_LOG_DIR:-${TMPDIR:-/tmp}/gf-ops-01-drill}
GF_OPS01_WORKER_DIR="$GF_OPS01_REPO/services/greenfield-worker"

gf_ops01_require_loopback() {
  case "$GF_OPS01_PG_ADMIN_URL" in
    postgres://*@127.0.0.1:*|postgresql://*@127.0.0.1:*|postgres://*@localhost:*|postgresql://*@localhost:*) ;;
    *) echo "REFUSING: GF_OPS01_PG_ADMIN_URL must be a loopback disposable server" >&2; exit 2 ;;
  esac
}

# gf_ops01_db_url <database> -> same server/credentials as the admin URL, other database
gf_ops01_db_url() { printf '%s/%s' "${GF_OPS01_PG_ADMIN_URL%/*}" "$1"; }

gf_ops01_create_db() {
  [[ "$1" == gf_ops01_drill_* ]] || { echo "REFUSING: drill database must be prefixed gf_ops01_drill_" >&2; exit 2; }
  psql -q -v ON_ERROR_STOP=1 "$GF_OPS01_PG_ADMIN_URL" -c "CREATE DATABASE $1"
}
gf_ops01_drop_db() {
  [[ "$1" == gf_ops01_drill_* ]] || return 0
  psql -q "$GF_OPS01_PG_ADMIN_URL" -c "DROP DATABASE IF EXISTS $1 WITH (FORCE)" || true
}
