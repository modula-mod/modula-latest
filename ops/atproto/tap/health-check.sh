#!/usr/bin/env bash
set -euo pipefail
echo "Tap pilot health-check: configuration present"
test -f "$(dirname "$0")/compose.yml"
test -f "$(dirname "$0")/configuration.example"
echo "PASS tap prep files present"
echo "NOTE: live Tap process is optional in Phase 6"
