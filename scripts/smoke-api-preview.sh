#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-https://api.modula.digital}"
check() {
  local path="$1"
  local body
  body="$(curl -fsS "${BASE}${path}")"
  echo "${body}" | node -e '
    const fs=require("fs");
    const body=JSON.parse(fs.readFileSync(0,"utf8"));
    if(!body || body.ok!==true || !body.meta || !body.meta.requestId) process.exit(2);
  '
  echo "ok ${path}"
}
check /v1/health/live
check /v1/health/ready
check /v1/meta
check /v1/feed/home
check /v1/profiles/andrei.modula
check /v1/discover
