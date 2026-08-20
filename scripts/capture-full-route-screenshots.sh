#!/usr/bin/env bash
# Capture every Expo Router surface on the booted iOS Simulator.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROUTES_JSON="$ROOT/.artifacts/full-route-screenshots/routes.json"
OUT="$ROOT/docs/validation/evidence/full-route-tour/screenshots"
UDID="${SIM_UDID:-0727E2F0-8528-44DA-9F4C-7B5F7394096B}"
SETTLE_MS="${SETTLE_MS:-1800}"

mkdir -p "$OUT"

if [[ ! -f "$ROUTES_JSON" ]]; then
  echo "missing $ROUTES_JSON" >&2
  exit 1
fi

# Ensure Modula is foregrounded
xcrun simctl launch "$UDID" digital.modula.app >/dev/null 2>&1 || true
sleep 1

# Prefer Development demo if sign-in is showing; ignore failures
xcrun simctl openurl "$UDID" 'modula:///' || true
sleep 2

python3 - <<'PY' "$ROUTES_JSON" "$OUT" "$UDID" "$SETTLE_MS"
import json, subprocess, sys, time, pathlib

routes_path, out_dir, udid, settle_ms = sys.argv[1:5]
settle = int(settle_ms) / 1000.0
routes = json.loads(pathlib.Path(routes_path).read_text())
out = pathlib.Path(out_dir)
manifest = []
ok = fail = 0

def run(cmd):
    return subprocess.run(cmd, check=False, capture_output=True, text=True)

for i, item in enumerate(routes, 1):
    route = item["route"]
    name = item["name"]
    # Expo deep link: modula://path
    link = "modula://" + (route[1:] if route.startswith("/") else route)
    if route == "/":
        link = "modula:///"
    shot = out / f"{i:03d}-{name}.png"
    print(f"[{i:03d}/{len(routes)}] {route} -> {shot.name}", flush=True)
    r = run(["xcrun", "simctl", "openurl", udid, link])
    time.sleep(settle)
    s = run(["xcrun", "simctl", "io", udid, "screenshot", str(shot)])
    status = "ok" if shot.exists() and shot.stat().st_size > 10_000 else "fail"
    if status == "ok":
        ok += 1
    else:
        fail += 1
    manifest.append({
        "index": i,
        "route": route,
        "name": name,
        "link": link,
        "file": shot.name,
        "bytes": shot.stat().st_size if shot.exists() else 0,
        "openurl_rc": r.returncode,
        "screenshot_rc": s.returncode,
        "status": status,
        "stderr": (r.stderr or s.stderr or "")[-400:],
    })

manifest_path = pathlib.Path(out_dir).parent / "manifest.json"
manifest_path.write_text(
    json.dumps({"ok": ok, "fail": fail, "total": len(routes), "shots": manifest}, indent=2)
)
print(f"DONE ok={ok} fail={fail} total={len(routes)} -> {manifest_path}", flush=True)
PY
