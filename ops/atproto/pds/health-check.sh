#!/usr/bin/env bash
set -euo pipefail
echo "PDS pilot health-check: deployment-ready files present"
test -f "$(dirname "$0")/compose.yml"
test -f "$(dirname "$0")/pds.env.example"
echo "PASS pds prep files present"
echo "STATUS: DEFERRED on shared Hestia/Nginx host unless go/no-go passes"
