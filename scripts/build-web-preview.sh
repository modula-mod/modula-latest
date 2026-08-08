#!/usr/bin/env bash
set -euo pipefail
umask 022
REPO="${MODULA_REPO:-/root/modula-latest}"
cd "${REPO}"
COMMIT="$(git rev-parse HEAD)"
BRANCH="$(git branch --show-current)"
BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
CACHE_BUSTER="${COMMIT:0:12}-$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${REPO}/.web-release"
rm -rf "${OUT}"
mkdir -p "${OUT}"
pnpm install --frozen-lockfile
export EXPO_PUBLIC_APP_ENV=preview
export EXPO_PUBLIC_DATA_SOURCE=remote
export EXPO_PUBLIC_API_URL=https://api.modula.digital
export EXPO_PUBLIC_DEMO_SESSION=guest
pnpm typecheck
pnpm lint
pnpm verify:phase1
pnpm verify:phase2
pnpm verify:theme
pnpm verify:phase3
pnpm verify:phase4
pnpm verify:phase5
pnpm exec expo export --platform web
test -d dist
cp -a dist/. "${OUT}/"
find "${OUT}" -type f -name '*.html' -print0 | xargs -0 perl -0pi -e "s#(_expo/static/js/web/entry-[^\"']+\\.js)(?!\\?)#\$1?v=${CACHE_BUSTER}#g"
cat > "${OUT}/release.json" <<JSON
{
  "commit": "${COMMIT}",
  "branch": "${BRANCH}",
  "builtAt": "${BUILT_AT}",
  "assetCacheBuster": "${CACHE_BUSTER}",
  "environment": "preview",
  "dataSource": "remote",
  "apiUrl": "https://api.modula.digital",
  "apiVersion": "v1",
  "protocolVersion": "0.1"
}
JSON
(cd "${OUT}" && find . -type f ! -name checksums.sha256 -print0 | sort -z | xargs -0 sha256sum > checksums.sha256)
echo "web_build_ok ${OUT}"
