#!/usr/bin/env bash
# Cloud Agent install for modula-latest.
#
# modula-latest consumes several packages from the sibling repository
# modula-mod/modula-module-standard through `file:../modula-mod/modula-module-standard/...`
# dependencies. Those packages resolve their types from dist/, so the sibling
# must exist at ../modula-mod/modula-module-standard (relative to this repo) and
# be built before this repo installs or typechecks. This script prepares that
# layout idempotently and then installs modula-latest.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARENT_DIR="$(dirname "$REPO_ROOT")"
MOD_ORG_DIR="$PARENT_DIR/modula-mod"
MODULE_STANDARD_DIR="$MOD_ORG_DIR/modula-module-standard"
MODULE_STANDARD_REPO="https://github.com/modula-mod/modula-module-standard.git"

# modula-latest pins no packageManager, but its lockfile uses the pnpm 11
# compact patchedDependencies format, so it must be installed with pnpm 11.
# The sibling repo pins its own pnpm via packageManager; Corepack switches the
# active version per directory automatically.
corepack prepare pnpm@11.21.0 --activate

# Ensure the parent directory for the file: dependency source exists. When the
# repo is checked out directly under a non-writable root (e.g. /workspace, whose
# parent is /), fall back to sudo to create and own the directory.
if [ ! -d "$MOD_ORG_DIR" ]; then
  if ! mkdir -p "$MOD_ORG_DIR" 2>/dev/null; then
    sudo mkdir -p "$MOD_ORG_DIR"
    sudo chown "$(id -u):$(id -g)" "$MOD_ORG_DIR"
  fi
fi

# Provide modula-module-standard at the expected path. Reuse an existing
# checkout when one is available (multi-repo workspaces expose the repos as
# siblings or under /agent/repos); otherwise clone it. Cloning requires the
# generated GitHub token to include modula-module-standard, which is declared
# via repositoryDependencies in .cursor/environment.json.
if [ ! -e "$MODULE_STANDARD_DIR" ]; then
  reused=""
  for candidate in \
    "$PARENT_DIR/modula-module-standard" \
    "/agent/repos/modula-module-standard"; do
    if [ -d "$candidate/.git" ]; then
      ln -s "$candidate" "$MODULE_STANDARD_DIR"
      reused="$candidate"
      break
    fi
  done
  if [ -z "$reused" ]; then
    git clone --depth 1 "$MODULE_STANDARD_REPO" "$MODULE_STANDARD_DIR"
  fi
fi

# Build modula-module-standard so its packages expose dist/ output that
# modula-latest's file: dependencies and typecheck resolve against.
(
  cd "$MODULE_STANDARD_DIR"
  corepack pnpm install --frozen-lockfile
  corepack pnpm build
)

# Install modula-latest itself.
cd "$REPO_ROOT"
corepack pnpm@11.21.0 install --frozen-lockfile
