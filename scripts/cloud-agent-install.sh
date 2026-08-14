#!/usr/bin/env bash
# Cloud Agent install for modula-latest.
#
# modula-latest consumes several packages from the sibling repository
# modula-mod/modula-module-standard through `file:` dependencies resolved at
# ../modula-mod/modula-module-standard. Those packages publish their types from
# dist/, so the sibling must be checked out and built before this repo installs
# or typechecks. This script prepares that layout idempotently and then installs
# modula-latest.
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

# 1. Ensure the file: dependency source is present at
#    ../modula-mod/modula-module-standard. Reuse an existing sibling checkout
#    (multi-repo workspace) when available; otherwise clone it.
mkdir -p "$MOD_ORG_DIR"
if [ ! -e "$MODULE_STANDARD_DIR" ]; then
  if [ -d "$PARENT_DIR/modula-module-standard/.git" ]; then
    ln -s "$PARENT_DIR/modula-module-standard" "$MODULE_STANDARD_DIR"
  else
    git clone --depth 1 "$MODULE_STANDARD_REPO" "$MODULE_STANDARD_DIR"
  fi
fi

# 2. Build modula-module-standard so its packages expose dist/ output that
#    modula-latest's file: dependencies and typecheck resolve against.
(
  cd "$MODULE_STANDARD_DIR"
  corepack pnpm install --frozen-lockfile
  corepack pnpm build
)

# 3. Install modula-latest itself.
cd "$REPO_ROOT"
corepack pnpm@11.21.0 install --frozen-lockfile
