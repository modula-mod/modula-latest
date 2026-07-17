#!/usr/bin/env bash
set -euo pipefail
if [[ "${CONFIRM:-}" != "yes" ]]; then
  echo "Refusing to run. Set CONFIRM=yes after controlled update window."
  exit 1
fi
echo "PDS update stub — pin reviewed image versions only"
