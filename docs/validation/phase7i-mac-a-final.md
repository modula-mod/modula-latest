# Phase 7I-MAC-A — Final Report

Date: 2026-08-10  
Mac branch: `phase7i-mac-native-ui-acceptance`  
Verdict: **BLOCKED**

## Source control

| Field | Value |
| --- | --- |
| GitHub source branch | `phase7i-trusted-production-alpha` |
| Source SHA | `0f9708bbaa1896e438dc3a9f5b28ec6d1327c353` |
| `origin/main` SHA | `dbc4bbfa73f1f87b502a9d59fbd76fdb28f0d6c7` |
| Decision | phase7i is **15 commits ahead** of main (ops/mail/runtime); use it, do not merge merely for Mac |
| Mac branch | `phase7i-mac-native-ui-acceptance` |
| Base SHA | `0f9708bbaa1896e438dc3a9f5b28ec6d1327c353` |
| Fresh clone | `~/Developer/modula-latest` (archives under `*-pre-phase7i-mac-a-20260810-215314`) |
| Sibling Module Standard | `~/Developer/modula-mod/modula-module-standard` @ `2bfc0a826d19db870a445e06d52010cec6e0a54f` |

Merge recommendation: **DO_NOT_MERGE** until SSH tunnel + signed-in golden path complete. Docs/UI fixes may land after re-audit.

## Toolchain

| Item | Value |
| --- | --- |
| Xcode | 26.6 (17F113) |
| CocoaPods | 1.16.2 |
| Simulator | iPhone 17 Pro · iOS 27.0 runtime |
| Expo SDK | 57 (`expo@57.0.11`, CLI 57.0.13) |
| React Native | 0.86.2 |
| React | 19.2.3 |
| Expo Router | 57.0.11 |
| `@expo/ui` | 57.0.9 |
| iOS deployment target | 16.4 |
| `pnpm install --frozen-lockfile` | OK (after Standard `dist` build) |
| `pnpm lint` | 0 errors / 0 warnings |
| `pnpm typecheck` | OK after workspace package prebuild |
| `expo install --check` | Patch drift within SDK 57 — left locked (see expo-doctor doc) |
| `expo-doctor` | 18/20 — classified in `phase7i-mac-a-expo-doctor.md` |
| `expo run:ios` | **Build Succeeded** · installed on Simulator |
| `xcodebuild` workspace Modula / scheme Modula | **BUILD SUCCEEDED** |

## API tunnel

| Check | Result |
| --- | --- |
| Public `https://api.modula.digital/v1/health/live` | `503 MAINTENANCE` (intentional — not lifted) |
| Local `http://127.0.0.1:4020` without tunnel | Connection refused |
| SSH `root@87.106.40.136` / `core.modula.digital` | **Permission denied (publickey)** |
| Mac pubkey | `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICKnqMCGPGY52p8nU1+fu7BUSoA1EbWQ4xSCexvGx5at msjoy@Mac.broadband` |
| Dev override | `.env.development.local` (gitignored): `DATA_SOURCE=remote`, `API_URL=http://127.0.0.1:4020` |

**Unblock:** authorize the Mac pubkey on the VPS, then:

```bash
ssh -N -L 4020:127.0.0.1:4020 root@87.106.40.136
curl -fsS http://127.0.0.1:4020/v1/health/live
curl -fsS http://127.0.0.1:4020/v1/health/ready
curl -fsS http://127.0.0.1:4020/v1/meta
```

## Auth

| Check | Result |
| --- | --- |
| Login UI renders | Yes (`01-login.png`) |
| Validation | Client validation present |
| Invalid / network | Shows **Network request failed** with red field; remains interactive |
| Real Greenfield login | **Blocked** (no tunnel) |
| Demo CTA | Hidden when `dataSource !== 'local'` (Checkpoint B fix) |
| Register UI | Route exercised; live policy probe blocked |

## Product surfaces (guest + offline API)

See `phase7i-mac-a-screen-map.md`.

| Area | Result |
| --- | --- |
| Home | Working shell; offline/skeleton honest |
| Stories | Guest: not mounted (query gated). Cause identified. Empty rail now honest on standalone surfaces. Signed-in proof pending tunnel |
| Navigation / tabs | Working; Create `+` present; no black gap under bar in Home shot |
| Drawer | Working via `modula:///?openDrawer=1` |
| Segmented Following/For You/Modules | All three visible |
| Settings | Navigable; list density needs further native polish |
| Appearance | Screen loads; Mode/Accent/Glass preview present; Dark tile needs visual re-check |
| Product Hub / modules | Shell only — API blocked |
| Module Host | Not exercised |

## Expo UI

Inventory: `docs/research/phase7i-mac-a-expo-ui-inventory.md`

**Completed this phase:** inventory + gate demo CTA + Stories empty honesty + verifiers.

**Recommended next (after tunnel):** Settings list/switch consolidation; expand context menus; leave Home sticky modes on shared track (no Host).

## Defects summary

| Sev | Count (open) | Highlights |
| --- | --- | --- |
| P0 | 1 | MAC-A-001 SSH tunnel / live API |
| P1 | 2 | Stories empty honesty (mitigated); signed-in Stories proof pending |
| P2 | several | Merge Preview copy; Settings density; sticky geometry risk |
| P3 | several | Drawer guest copy; deep-link tooling |

Full table: `phase7i-mac-a-ui-defects.md`

## Screenshots

- Before: `docs/validation/evidence/phase7i-mac-a-before/`
- After: `docs/validation/evidence/phase7i-mac-a-after/` (partial until tunnel re-run)

## Checkpoint B changes landed

1. Stories rail: honest empty state instead of silent `null`
2. Sign-in: hide development demo account when not on local data source
3. Docs + verifiers: `verify:phase7i-mac-native`, `verify:phase7i-mac-ui-boundary`, `verify:phase7i-mac-expo-ui`

## Verdict

```text
BLOCKED
```

Blocking reason: cannot establish the required SSH local tunnel to private Greenfield (`4020`), so real auth, Stories-with-session, Module Host, and reconnect golden path cannot be completed. Native Simulator build and guest/offline UI audit succeeded.
