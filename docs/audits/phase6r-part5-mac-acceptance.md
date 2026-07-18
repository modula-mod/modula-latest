# Phase 6R — PART 5 Mac acceptance

**Date:** 2026-07-18 (UTC+1)  
**Branch:** `phase6-greenfield-sovereign-core`  
**HEAD SHA tested:** `f579ca2d7715c4931014f146b800fe06d0361b2e` (matches expected PART 4 tip)  
**PR merge (PART 6):** not performed  
**TestFlight:** not created  

## Environment

| Item | Value |
|---|---|
| API | `https://api.modula.digital` |
| Client env (`.env.local`) | `EXPO_PUBLIC_APP_ENV=preview`, `EXPO_PUBLIC_DATA_SOURCE=remote`, `EXPO_PUBLIC_API_URL=https://api.modula.digital` |
| Live `/v1/meta` | `backend: greenfield`, `environment: preview`, `atproto: false`, `greenfieldAccounts/Sessions/Repositories/Extensions: true`, `inviteOnly: true` |
| Physical iPhone | **Unavailable** — no USB/devicectl iPhone; `xctrace` “Andrei Milea” is this Mac, not a phone; `expo run:ios --device "Andrei Milea"` → no matching device |
| Simulator | Available (iPhone 17 Pro Max booted among others); interactive UI walk **not** fully executed in this pass |
| SMTP / public registration | Not configured (PART 4) — invite-only; Mac cannot open a new real account without invite + email delivery |

## Known PART 4 limitations (acknowledged — not Mac regressions)

1. SMTP not configured → invite-only preview; no public registration opening.  
2. Extension Centre **published** catalog empty beyond seeded tools; Vault/Tasks module tools unavailable; AT bridge disabled.  
3. Backup restore test skipped on VPS (no isolated restore DB).  
4. Core VPS smoke already passed: invite register, verify, sign-in, handle change, private records/export, refresh reuse revoke, session revoke, AT-disabled rejection.

---

## Static validation (Mac re-run)

| Check | Result | Notes |
|---|---|---|
| `pnpm install --frozen-lockfile` | **PASS** | |
| `pnpm exec expo install --check` | **FAIL** (pre-existing) | Patch drift (`expo@57.0.6` vs expected `~57.0.7`, etc.) — not introduced by PART 5 |
| `pnpm typecheck` | **PASS** | Includes `@modula/dimon-contracts` |
| `pnpm lint` | **FAIL** (pre-existing) | Errors in liquid-glass tab bar immutability + SkeletonBlock refs; Phase 6 `AccountSessionsScreen` setState-in-effect; warnings elsewhere |
| `pnpm verify:phase1` | **FAIL** (pre-existing) | Route layout / reanimated policy drift |
| `pnpm verify:phase2` | **FAIL** (pre-existing) | Reanimated / BlurView policy drift |
| `pnpm verify:theme` | **PASS** | |
| `pnpm verify:phase3` | **FAIL** (pre-existing) | Route thinness / reanimated drift |
| `pnpm verify:phase4` | **PASS** | |
| `pnpm verify:phase5` | **PASS** | |
| `pnpm verify:phase6-greenfield-backend` | **PASS** | Includes DIMON contracts + no balances/blockchain |
| `pnpm verify:phase6-greenfield-frontend` | **PASS** | 22/22 |
| `pnpm exec expo export --platform web` | **PASS** | 100 static routes incl. register/verify/extensions/dimon/export |
| `git diff --check` | **PASS** | |

**Mac-side bugs found that block acceptance:** none requiring a PART 5 code fix. Pre-existing lint / phase1–3 / expo-check drift remains out of scope.

---

## 82. Physical iPhone gate

| Case | Result | Evidence / blocker |
|---|---|---|
| Create Modula account | **BLOCKED** | No physical device; SMTP/invite blocks new Mac-created account |
| Verify email | **BLOCKED** | SMTP not configured (PART 4); no device |
| Sign in | **BLOCKED** (device) / **PASS** (API path) | PART 4 VPS smoke; Mac: `POST /v1/sessions` rejects bad creds with `UNAUTHENTICATED` |
| Cold launch | **BLOCKED** | No physical device |
| Session restore / refresh / revocation | **BLOCKED** (device) / **PASS** (PART 4 API) | VPS smoke covered refresh reuse + session revoke |
| Change handle | **BLOCKED** (device) / **PASS** (PART 4 API) | |
| Profile intact | **PARTIAL** | Mac: `GET /v1/profiles/andrei.modula` 200 without AT; device UI not run |
| Create / edit / delete post | **PARTIAL** | Mac: `POST /v1/posts` 201 with preview session, AT bridge disabled; edit/delete + device UI not run |
| Like / save / repost / follow | **BLOCKED** | No interactive device/simulator automation in this pass |
| Notifications | **PARTIAL** | Mac: authenticated `GET /v1/notifications` 200 |
| Search | **PARTIAL** | Mac: `GET /v1/search?q=test` 200 |
| Extension Centre | **PARTIAL** | Frontend routes + verifier PASS; published catalog empty (PART 4); device UI not run |
| Composer Tools | **PARTIAL** | Live `GET /v1/tools` returns 9 seeded tools; FE drawer gates unavailable modules; device UI not run |
| Sync / queued / failure function | **BLOCKED** | Live `GET /v1/functions` empty; no invokeable function on preview; FE models states (verifier #15) |
| Disable / re-enable plugin | **BLOCKED** | Live `GET /v1/plugins` empty; needs device + installed plugin |
| AT absent from onboarding | **PASS** (code/static) | Welcome copy + frontend verifier #6; web export includes native auth routes without AT requirement |
| AT optional in Connections | **PASS** (code/static) | Connections screen External Networks framing; AT disabled in env |
| Repository export | **BLOCKED** (Mac interactive) / **PASS** (PART 4 API) | Preview session cannot auth Greenfield repo routes; PART 4 private export smoke |
| Offline | **BLOCKED** | No device |
| Background / foreground | **BLOCKED** | No device |

**Device attempt summary**

- `xcrun xctrace list devices`: Mac host “Andrei Milea”; simulators only for iOS.  
- `xcrun devicectl list devices`: no physical iPhone (`reality: simulated` only).  
- USB: no iPhone.  
- `pnpm exec expo run:ios --device "Andrei Milea"`: `No device UDID or name matching "andrei milea"`.

---

## 83. Account ownership proof (must prove)

| Claim | Result | Evidence |
|---|---|---|
| Account works without AT Protocol | **PASS** | Live meta: `atproto: false` + `greenfieldAccounts: true`; PART 4 invite/register/sign-in smoke; AT OAuth returns `CAPABILITY_DISABLED` while Greenfield social read/post still works |
| Registration without AT | **PASS** (API contract) / **BLOCKED** (new Mac account) | `POST /v1/accounts/register` without invite → `403 Valid invitation required` (not AT-related); PART 4 completed invite register + verify; SMTP blocks repeating verify on Mac |
| Sign-in without AT | **PASS** | PART 4 VPS; Mac: sessions endpoint live (`Invalid credentials` without AT involvement) |
| Posting without AT | **PASS** | Mac: `POST /v1/posts` **201** while `POST /v1/atproto/oauth/start` → **403 CAPABILITY_DISABLED** |
| Profile without AT | **PASS** | Mac: public/auth profile fetch 200; About UI omits DID framing (frontend verifier #17–18) |
| Repository without AT | **PASS** (PART 4) / **BLOCKED** (Mac session type) | PART 4 private records + export; Mac preview session is **not** a Greenfield account bearer for `/v1/repositories/*` / `/v1/accounts/me` (401) — expected gap until invite Greenfield session on Mac |
| Extensions without AT | **PASS** (surface) | `GET /v1/tools` 200 (9 tools); `greenfieldExtensions: true`; Extension Centre FE + verifier; published catalog empty (PART 4 limitation, not AT) |
| AT bridge disabled without Greenfield failure | **PASS** | Meta healthy; `/v1/health/live` + `/ready` 200; feed/home 200; tools 200; post 201; AT paths 403 `CAPABILITY_DISABLED` |

---

## 84. Extension acceptance

| Item | Result | Notes |
|---|---|---|
| Tool registry | **PASS** | Live `GET /v1/tools` → 9 tools (`aiAssist`, `automation`, `camera`, `commentToDm`, `createTask`, `link`, `photo`, `poll`, `saveToVault`) |
| Composer tools | **PASS** (static + API) | Frontend verifier #13; drawer loads registry; device UI **BLOCKED** |
| Unavailable module tool messaging | **PASS** (static) / **PARTIAL** (runtime) | `createTask` + `saveToVault` availability `unavailable`; FE shows `Requires …` (verifier #14) |
| Function validation / timeout / queue | **PARTIAL** | FE models `idle/validating/running/queued/completed/failed/cancelled` (verifier #15); live functions list **empty** — runtime invoke **BLOCKED** |
| Plugin lifecycle / isolation | **BLOCKED** | Live plugins list empty; no installable published extensions |
| Connector disabled | **PASS** (env) | `modules: false`, connectors list empty; AT connector disabled via capability |
| Widget manifests | **N/A** / **BLOCKED** | Live widgets list empty |
| Untrusted cannot execute | **PASS** (code) | `trust-policy.ts`: `untrustedManifest` discovery only; `trustAllowsExecution` limited to firstParty/verifiedPublisher; backend verifier #31–34 |
| Published Extension Centre catalog | **BLOCKED** (PART 4) | `GET /v1/extensions` → `[]` |

---

## 85. DIMON acceptance

| Item | Result | Evidence |
|---|---|---|
| `@modula/dimon-contracts` exists | **PASS** | Package present; typecheck in workspace `pnpm typecheck` |
| Capability namespace exists | **PASS** | `dimon:account:read/link`, `dimon:transaction:request/approve`, `dimon:ledger:audit` |
| Greenfield can support future linkage | **PASS** | ADR-009 + `docs/architecture/dimon-future-integration-boundary.md`; stable account IDs / checkpoints / extension namespaces reserved |
| NO balances / fake tx / wallet keys / blockchain | **PASS** | Placeholder screen copy; contracts comments; backend verifier #39–42; no ethers/web3/etc. in scanned package manifests; frontend verifier #19–20 |

---

## 86. TestFlight gate

| Prerequisite | Status |
|---|---|
| Static validation (phase4/5/6 + typecheck + web export) | **PASS** (phase1–3/lint/expo-check pre-existing FAIL) |
| Greenfield deploy | **PASS** (live meta/health; PART 4) |
| Native registration | **PARTIAL** — code/routes PASS; live invite+SMTP path not re-proven on Mac UI |
| Session security | **PASS** (PART 4 API) / device UI **BLOCKED** |
| Physical iPhone | **BLOCKED** |
| Record protocol | **PASS** (PART 4) / Mac Greenfield session **BLOCKED** |
| Repo export | **PASS** (PART 4) / Mac interactive **BLOCKED** |
| Extension kernel | **PARTIAL** — tools + trust policy PASS; published catalog / plugin lifecycle **BLOCKED** |
| AT-independent operation | **PASS** |
| Backup restore | **BLOCKED** (PART 4 skipped — no isolated restore DB) |

### TestFlight readiness: **NOT READY**

Reasons: physical iPhone acceptance incomplete; backup restore not proven; SMTP prevents honest end-to-end email verification on Mac; published extension catalog / plugin lifecycle not exercisable beyond seeded tools.

---

## Live API smoke (Mac → preview)

| Endpoint | Result |
|---|---|
| `GET /v1/meta` | **PASS** — greenfield, AT off, inviteOnly |
| `GET /v1/health/live` / `ready` | **PASS** |
| `GET /v1/feed/home` | **PASS** |
| `GET /v1/tools` | **PASS** — 9 seeded tools |
| `GET /v1/extensions` / `functions` / `plugins` / `widgets` / `modules` / `connectors` | **PASS** (empty arrays where noted) |
| `GET /v1/search?q=test` | **PASS** |
| `POST /v1/accounts/register` (no invite) | **PASS** (correct deny) — `403 Valid invitation required` |
| `POST /v1/atproto/oauth/start` | **PASS** (correct deny) — `403 CAPABILITY_DISABLED` |
| `POST /v1/auth/preview/session` + `POST /v1/posts` | **PASS** — post without AT |
| Greenfield `/v1/accounts/me`, `/v1/repositories/*` with preview token | **FAIL auth** — preview bearer ≠ Greenfield account session (documented; PART 4 covered real sessions) |

---

## Overall PART 5 verdict

**PARTIAL — Mac static + AT-independent API ownership proven; physical/TestFlight not ready.**

### Core Greenfield flows (acceptable evidence)

- Greenfield backend live; AT optional bridge disabled without cascading failure.  
- Ownership without AT: meta, feed, profile, post create, tools registry, invite-gated registration contract.  
- Frontend Phase 6R surface (auth routes, Extension Centre, Composer tools, DIMON placeholder, export UI) verified statically (22/22).  
- DIMON reserved correctly with no economic/blockchain surface.

### Blocked / incomplete

- Physical iPhone interactive checklist.  
- SMTP-backed email verify + Mac-side new account creation.  
- Greenfield repository/export/session UI against a real invite session on this Mac.  
- Extension published catalog, plugin lifecycle, live function invoke/queue.  
- Backup restore proof (PART 4).  
- TestFlight.

---

## Recommendation for PART 6 (merge)

**Do not merge yet** — definition of done for Phase 6R acceptance is **not** fully met.

### Remaining blockers for definition of done

1. Attach a deployable physical iPhone and complete §82 interactive walk (account → social → extensions → offline/foreground).  
2. Configure SMTP (or controlled invite + out-of-band verify) so email verification can be honestly re-proven from client.  
3. Complete backup restore on an isolated DB (PART 4 carry-over).  
4. Populate or accept-as-preview the Extension Centre published catalog sufficiently to exercise install/disable/re-enable + one function invoke path — or explicitly waive catalog items in product DoD.  
5. Only after the above: create TestFlight (Release/EAS, no Metro-only ship), then consider PART 6 merge of the Greenfield PR when product owners authorize.

Pre-existing `expo install --check` / lint / phase1–3 verifier drift should be tracked separately; they did not uniquely block Greenfield ownership proof in this pass.
