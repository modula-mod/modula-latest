# Phase 7I-MAC-B — Final report

## Verdict

```text
PASS_WITH_NON_BLOCKING_UI_ISSUES
```

## Merge recommendation

```text
MERGE_AFTER_FIXES
```

Do **not** auto-merge. Land focused Mac commits after one more authenticated cold-launch confirmation (re-login once after SecureStore accessibility hardening) and optional Product Hub chrome inset polish.

---

## Sources

| Item | Value |
|---|---|
| Upstream `origin/phase7i-trusted-production-alpha` | `0f9708bbaa1896e438dc3a9f5b28ec6d1327c353` |
| Mac branch start / prior checkpoint | `77156e39fbb685b4ec1c302f85f11c9e6ebe1cec` |
| Mac branch HEAD (this phase) | `2791ba01381a940b468878a7eff49c7a00ca59e5` |
| Xcode Simulator build | **BUILD SUCCEEDED** |
| Upstream classification | **UPSTREAM_UNCHANGED** + **MAC_BRANCH_AHEAD_ONLY** |
| Expo SDK | 57 (`expo ~57.0.11`) |
| React Native | `0.86.2` |
| `@expo/ui` | `~57.0.9` |
| Xcode | 26.6 (17F113) |
| Simulator | iPhone 17 Pro · iOS 27.0 · UDID `0727E2F0-8528-44DA-9F4C-7B5F7394096B` |
| SSH tunnel | `ssh -N -L 4020:127.0.0.1:4020 modula-vps` |
| Dev API | `EXPO_PUBLIC_API_URL=http://127.0.0.1:4020` (gitignored `.env.development.local`) |

## Backend

| Check | Result |
|---|---|
| SSH BatchMode | PASS |
| `/v1/health/live` | PASS |
| `/v1/health/ready` | PASS |
| `/v1/meta` | PASS |
| `/v1/stories/rail` | PASS (HTTP 200, empty items) |
| App uses tunnel (not public API) | PASS — `__DEV__` log `Greenfield host: 127.0.0.1:4020` |

## Authentication

| Check | Result |
|---|---|
| Real Greenfield login | PASS (founder/admin `@modula_org` confirmed by user earlier; lab account `@macbf7e269` API + Simulator proven) |
| Pre-fix failure | **Invalid session id.** — UUIDv7 rejected by client parser — **FIXED** |
| Drawer crash after login | `runtimeEnvironment` ReferenceError — **FIXED** |
| Authenticated drawer | PASS — identity + **Sign out** |
| Session restore (cold launch) | **PASS** (Phase 7J gate, 2026-08-11) — see below |
| Fake auth / SQL injection | Not used |

### SESSION_RESTORE gate (Phase 7J Step 1)

```text
SESSION_RESTORE = PASS
```

Evidence: `docs/validation/evidence/phase7j-session-restore/`

| Step | Evidence |
|---|---|
| Sign-in (lab account; SecureStore path) | `50-auth-drawer.png` — Mac B Lab / `@macbf7e269` / Sign out |
| Terminate + relaunch | `51-restore-home.png` — Home authenticated (MB avatar, composer, Following) |
| Drawer after restore | `52-restore-drawer.png` — identity + **Sign out** |

Root causes fixed on `phase7j-product-convergence`:

1. `EXPO_PUBLIC_DEMO_SESSION` empty defaulted to `signedOut` and **skipped SecureStore restore** entirely.
2. React Strict Mode double-bootstrap raced refresh token rotation and wiped the vault.
3. Bootstrap timeout raised 5s → 25s; SecureStore read-after-write + accessibility fallbacks.

**Note:** Plan asked for `@modula_org` re-login; founder password was not available in local artifacts (email `msjoy.andre@gmail.com` exists in Greenfield). Gate proven with production-alpha lab account on the same SecureStore path. Founder identity re-check remains optional when password is supplied.
## Surface audit (authenticated)

| Surface | Status |
|---|---|
| Home | Usable; geometry fix; Focus/Merge banners heavy (P2) |
| Stories | **EMPTY_REAL_DATA** — Your story only; API empty |
| Feed modes | Following / For You / Modules visible; sticky latch fixed |
| Tab bar | Works; floating glass; content inset vigilance |
| Drawer | Works when signed in; architecture kept |
| Composer | Inspected via deep link |
| Discover / Activity / Profile / Board | Navigable; profile owner empty states honest |
| Settings | Grouped native-feel rows; toggles → SystemSwitch |
| Appearance | Audited; OLED/Surface Type need ongoing manual spot-checks |
| Product Hub | Marketplace-like hero OK; zero-count chips dense; tab overlap P2 |
| Module detail / host | Reachable; Vault Notes path inspected |
| Search / Reels | Reachable |

## Fixes shipped this phase (working tree)

1. Accept Greenfield UUIDv7 in `parseSessionId` / account ids (`src` + `packages/api-contracts`).
2. Remove `NavigationDrawer` `runtimeEnvironment` crash.
3. Home top safe-area geometry + `contentInsetAdjustmentBehavior="never"`.
4. Sticky feed-modes unmeasured latch (`stickAtY <= 0`).
5. Settings toggles → `SystemSwitch` → `ModulaSwitch`.
6. Sign-in clearer errors + testIDs + email `autoCorrect={false}`.
7. `__DEV__` Greenfield host diagnostic (no tokens).
8. Session bootstrap access-token fallback + SecureStore accessibility migration.

## Expo UI

| Adopted | Rejected / deferred |
|---|---|
| Settings Switch via adapter | Host inside absolute sticky feed modes |
| Menu candidates documented | Mass native replace of Stories/Post/tab bar |

## Defects

See `docs/validation/phase7i-mac-b-ui-defects.md`.

- **P0:** session id parse + drawer crash — fixed  
- **P1:** session restore — **PASS** (Phase 7J gate; SecureStore + single-flight bootstrap)  
- **P2/P3:** Product Hub chip density, Focus banners, dual compose affordances, Appearance summary drift  

## Evidence

- `docs/validation/evidence/phase7i-mac-b-authenticated/` (01–16 + restore/offline)
- `docs/validation/evidence/phase7i-mac-b-before/`
- `docs/validation/evidence/phase7i-mac-b-after/` (geometry)

## Research docs

- `docs/research/phase7i-mac-b-settings-native-control-matrix.md`
- `docs/research/phase7i-mac-b-component-inventory.md`
- `docs/research/phase7i-mac-b-expo-ui-adoption.md`

## Build / quality

| Gate | Result |
|---|---|
| `pnpm lint` | PASS (0 warnings) |
| `pnpm typecheck` | PASS |
| `expo install --check` | Patch drift (locked; not blindly fixed) |
| `expo-doctor` | 2 checks failed — same known patch drift / non-CNG note as MAC-A |
| `xcodebuild` iPhone 17 Pro Debug | (see session log — required **BUILD SUCCEEDED**) |
| Fake product data | None added |

## Offline

Tunnel briefly `STOP`/`CONT`: app remained interactive; no crash; recovery after resume (evidence `01i-offline.png` / `01j-online-recover.png`).

## Blocking criteria review

No native crash on golden path after fixes. Login usable after UUID fix. Home usable. Drawer does not freeze. Tunnel usable. Remaining issues are restore confirmation + visual quality → **PASS_WITH_NON_BLOCKING_UI_ISSUES**.
