#!/usr/bin/env bash
set -euo pipefail
REPO="${MODULA_REPO:-/home/andrei/modula-latest}"
cd "${REPO}"
COMMIT="$(git rev-parse HEAD)"
BRANCH="$(git branch --show-current)"
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
cat > "${OUT}/release.json" <<JSON
{
  "commit": "${COMMIT}",
  "branch": "${BRANCH}",
  "builtAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "preview",
  "dataSource": "remote",
  "apiUrl": "https://api.modula.digital",
  "apiVersion": "v1",
  "protocolVersion": "0.1"
}
JSON
(cd "${OUT}" && find . -type f ! -name checksums.sha256 -print0 | sort -z | xargs -0 sha256sum > checksums.sha256)
echo "web_build_ok ${OUT}"
