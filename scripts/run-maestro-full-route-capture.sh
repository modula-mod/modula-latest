#!/usr/bin/env bash
# Run Maestro chunk flows and copy screenshots into evidence.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHUNKS="$ROOT/.artifacts/full-route-screenshots/maestro-chunks"
DEST="$ROOT/docs/validation/evidence/full-route-tour/screenshots"
mkdir -p "$DEST"

# Ensure demo session once
maestro test "$ROOT/.artifacts/full-route-screenshots/force-demo.yaml" --format NOOP

count=$(tr -dc '0-9' < "$CHUNKS/chunk-count.txt")
for ((i=1; i<=count; i++)); do
  flow=$(printf '%s/chunk-%02d.yaml' "$CHUNKS" "$i")
  echo "=== Running $flow ==="
  maestro test "$flow" --format NOOP
  latest=$(ls -td /Users/msjoy/.maestro/tests/*/chunk-*/takeScreenshot 2>/dev/null | head -1 || true)
  if [[ -n "${latest:-}" && -d "$latest" ]]; then
    cp -f "$latest"/*.png "$DEST/" 2>/dev/null || true
    echo "copied from $latest -> $(ls "$latest"/*.png | wc -l | tr -d ' ') files"
  fi
done

# Also copy verified smoke + force-demo profile
for dir in /Users/msjoy/.maestro/tests/*/force-demo/takeScreenshot \
           /Users/msjoy/.maestro/tests/*/smoke-key-routes/takeScreenshot; do
  [[ -d "$dir" ]] || continue
  cp -f "$dir"/*.png "$DEST/" 2>/dev/null || true
done

echo "Shot count: $(ls "$DEST"/*.png 2>/dev/null | wc -l | tr -d ' ')"
