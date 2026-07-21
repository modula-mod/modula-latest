# Phase 6 — PART 5 Mac final acceptance

**Date:** 2026-07-17 (UTC+1)  
**Branch:** `phase6-atproto-backend`  
**Synced SHA:** `eed6773c3c8d691b6dc103c6fec5e1783e9bc264` (matches `origin/phase6-atproto-backend`)  
**PR #4 → main:** remains OPEN — not merged in PART 5  
**PDS:** DEFERRED (`pdsPilot: false` on live `/v1/meta`)

## 88. Frontend suite

| Check | Result | Notes |
|---|---|---|
| `pnpm install --frozen-lockfile` | PASS | |
| `pnpm exec expo install --check` | FAIL (pre-existing) | Several Expo packages one patch behind (`~57.0.7` expected); not introduced by PART 5 |
| `pnpm typecheck` | PASS | |
| `pnpm lint` | FAIL (pre-existing) | Errors in liquid-glass tab bar immutability + SkeletonBlock refs; unrelated warnings |
| `pnpm verify:phase1` | FAIL (pre-existing) | Route layout / reanimated policy drift from Phase 1 verifier |
| `pnpm verify:phase2` | FAIL (pre-existing) | Same reanimated / BlurView policy drift |
| `pnpm verify:theme` | PASS | |
| `pnpm verify:phase3` | FAIL (pre-existing) | Same route-thinness / reanimated policy drift |
| `pnpm verify:phase4` | PASS | |
| `pnpm verify:phase5` | PASS | |
| `pnpm verify:phase6-frontend` | PASS | 20/20 |
| `pnpm verify:phase6-backend` | PASS | Runnable on Mac without VPS secrets (static tree checks) |
| `pnpm exec expo export --platform web` | PASS | 84 static routes including AT connections / OAuth routes |
| `git diff --check` | PASS | |

## 89. Native iOS builds

### Root cause resolved (Simulator link)

After DerivedData wipe, Debug builds were linking a **Release** React-Core prebuilt (no `Sealable` / packager symbols) → `expo-dev-launcher` undefined symbols. Fresh `pod install` extracts Debug core; forcing replace via `replace-rncore-version.js` confirms Sealable/Packager present.

`ios.buildReactNativeFromSource=true` was tried and **reverted** — Xcode 26.3 failed compiling ExpoModulesCore Swift concurrency checks.

### Results

| Build | Result | Notes |
|---|---|---|
| `pod install` | PASS | ExpoAtprotoOAuthClient included |
| Simulator `xcodebuild` Debug | PASS | iPhone 17 Pro Max / also ran on iPhone 16 Pro 18.4 |
| Simulator install + launch | PASS | `digital.modula.app` |
| Device `xcodebuild` `generic/platform=iOS` | PASS | `CODE_SIGNING_ALLOWED=NO` compile |
| Physical device install | SKIP | No deployable iPhone attached (see §90) |

### Runtime blocker fixed during PART 5

Metro failed resolving `@atproto/oauth-client-expo@0.1.8` (`./expo-oauth-client.js` missing; platform files are `.native.js` / `.web.js`).

**Fix:** pnpm patch `patches/@atproto__oauth-client-expo@0.1.8.patch` — import `./expo-oauth-client` so Metro platform resolution works. Registered in `pnpm-workspace.yaml` `patchedDependencies`.

After patch + Metro clear: bundle succeeds; Settings → Connected Accounts → AT Protocol UI loads.

## 90. Physical iPhone acceptance checklist

**Device inventory (this Mac):**

- `xctrace`: “Andrei Milea” is the **Mac**, not an iPhone (no iOS version).
- Only physical iPhone: **Nicola’s iPhone (2)** — offline / `devicectl` unavailable.
- USB: no attached iPhone.

Therefore interactive physical checklist items are **SKIP** unless noted as code/API evidence.

| Case | Result | Notes |
|---|---|---|
| Cold launch | PARTIAL | Simulator cold launch + Metro: app runs; navigates Home/Settings/AT. Physical SKIP |
| Native tabs | PARTIAL | Simulator route changes to board/discover/index/profile. Physical SKIP |
| Home feed | PARTIAL | API `GET /v1/feed/home` 200; Simulator UI not fully exercised. Physical SKIP |
| Post create / edit / delete | PARTIAL | API create post 201; Simulator compose shows sign-in gate. Physical SKIP |
| Like / Save / Repost / Follow | SKIP | No interactive physical / Simulator UI automation |
| Notifications | PARTIAL | API `GET /v1/notifications` 200. Physical SKIP |
| Search | PARTIAL | API `GET /v1/search?q=test` 200 (`/v1/discover/search` 404). Physical SKIP |
| Block / Mute / Report preview | SKIP | No interactive run |
| Connect AT account | PARTIAL | Simulator AT screen + “Connect identity”; OAuth browser not completed. Physical SKIP |
| Cancel OAuth | SKIP | Needs human browser dismiss |
| Reconnect | SKIP | |
| Grant publishing | SKIP | |
| Modula-only post | SKIP | Code default destination `modula` |
| Cross-posted public post | SKIP | Needs live OAuth + publish |
| AT publication failure | SKIP | |
| AT publication retry | SKIP | |
| Imported AT content | SKIP | |
| Atmosphere Preview | SKIP | Discover route visited; UI not asserted |
| Disconnect | SKIP | |
| Offline state | SKIP | |
| Background and foreground | SKIP | |
| Secure session restoration | SKIP | |
| Private posts never expose AT publishing | PASS (code) | `evaluateCrossPostEligibility` blocks non-`public` audiences; Composer hides destination selector when not allowed. Simulator AT screen shows public-data warning copy |

### Live API smoke (preview)

| Endpoint | Result |
|---|---|
| `POST /v1/auth/preview/session` | PASS |
| `GET /v1/meta` | PASS — `atproto`, `atprotoOAuth`, `atprotoPublishing`, `atprotoImport` true; `pdsPilot` false |
| `GET /v1/feed/home` | PASS |
| `GET /v1/notifications` | PASS |
| `GET /v1/atproto/connections` | PASS |
| `POST /v1/atproto/oauth/start` | PASS — returns `authorizationUrl` + `state` (no tokens in app) |
| `POST /v1/posts` (public) | PASS 201 |
| Backend deployment / worker / backup | ASSUME PASS from PART 4 (API live; no contrary evidence) |

## 91. TestFlight gate

| Gate | Status |
|---|---|
| Native Simulator | PASS (build + patched runtime UI smoke) |
| Physical iPhone | SKIP / unverified |
| OAuth | PARTIAL (start API + UI; no completed native OAuth) |
| Cross-post | SKIP |
| Disconnect | SKIP |
| Private-content restriction | PASS (code + Composer gate) |
| Backend deployment | PASS (assumed PART 4 + live meta/feed) |
| Worker | PASS (assumed PART 4) |
| Backup restore | PASS (assumed PART 4) |

**TestFlight: NOT CREATED** — physical + OAuth/cross-post/disconnect gates incomplete.

## Overall PART 5

**PARTIAL**

- Mac sync + Phase 6 verifiers + web export: good.
- Native Simulator **build** unblocked; Metro OAuth package patch required for JS runtime.
- Physical iPhone acceptance blocked by no attached device.
- Do **not** merge PR #4 / do **not** start PART 6 until full physical + OAuth acceptance.

## Human follow-up blockers

1. Attach a deployable iPhone (or bring Nicola’s online) and run §90 interactively with a **disposable** AT account.
2. Complete OAuth cancel / reconnect / publish / disconnect / cross-post / private-restriction UI checks on device.
3. Optionally bump Expo patch versions (`expo install --check`) and address pre-existing lint/phase1–3 verifier drift (out of PART 5 scope).
4. After full PASS, create TestFlight **without Metro** (Release / EAS) and only then proceed to PART 6 merge of PR #4.
