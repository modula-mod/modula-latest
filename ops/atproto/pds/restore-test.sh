#!/usr/bin/env bash
set -euo pipefail
if [[ "${CONFIRM:-}" != "yes" ]]; then
  echo "Refusing to run. Set CONFIRM=yes after go/no-go approval."
  exit 1
fi
echo "PDS restore-test stub — implement after live pilot approval"
