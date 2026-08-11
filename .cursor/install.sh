#!/usr/bin/env bash
# Cloud Agent install for Modula (github.com/modula-mod/modula-latest).
#
# The root package.json depends on several @modula/module-* packages via
# `file:../modula-mod/modula-module-standard/packages/*`. That sibling checkout
# is a separate public repository, so it must be present and built before the
# workspace install can resolve those file: dependencies. Local workspace
# packages also expose `main: ./dist/index.js`, so they are compiled here.
#
# Idempotent: safe to re-run. Updates the sibling checkout in place instead of
# re-cloning, and pnpm installs converge without rewriting pinned versions.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PARENT_DIR="$(cd "$REPO_ROOT/.." && pwd)"
SIBLING_PARENT="$PARENT_DIR/modula-mod"
SIBLING="$SIBLING_PARENT/modula-module-standard"
SIBLING_REPO_URL="https://github.com/modula-mod/modula-module-standard.git"

echo "[install] repo root:      $REPO_ROOT"
echo "[install] sibling target: $SIBLING"

# Ensure the sibling parent directory exists. When the repo is checked out at
# the filesystem root (e.g. /workspace) the parent is not writable, so fall
# back to non-interactive sudo.
if [ ! -d "$SIBLING_PARENT" ]; then
  if ! mkdir -p "$SIBLING_PARENT" 2>/dev/null; then
    echo "[install] creating $SIBLING_PARENT with elevated permissions"
    sudo -n mkdir -p "$SIBLING_PARENT"
    sudo -n chown "$(id -u):$(id -g)" "$SIBLING_PARENT"
  fi
fi

# Clone or update the public module-standard sibling repository.
if [ -d "$SIBLING/.git" ]; then
  echo "[install] updating existing sibling checkout"
  git -C "$SIBLING" fetch --depth 1 origin main
  git -C "$SIBLING" reset --hard FETCH_HEAD
else
  echo "[install] cloning sibling repository"
  git clone --depth 1 "$SIBLING_REPO_URL" "$SIBLING"
fi

# Build the sibling packages so their dist/ output exists for file: consumers.
echo "[install] installing and building sibling packages"
(
  cd "$SIBLING"
  pnpm install --no-frozen-lockfile
  pnpm -r build
)

# Install workspace dependencies and build local TypeScript packages.
echo "[install] installing workspace dependencies"
cd "$REPO_ROOT"
pnpm install --no-frozen-lockfile
echo "[install] building workspace packages"
pnpm -r --filter "./packages/*" build

echo "[install] done"
