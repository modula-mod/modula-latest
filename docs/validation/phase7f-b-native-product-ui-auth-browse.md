# Phase 7F-B — Native Product UI, Stories, Authentication and Browse

**Date:** 2026-08-05  
**Branch:** `phase7f-b-native-product-ui-auth-browse`  
**Verdict:** `PARTIAL`

## Source

| Item | Value |
| --- | --- |
| Starting branch | `origin/phase7f-a-mac-ios-smoke` (7F-A **not** merged into `main`) |
| Starting commit | `34ba1dc` |
| Final commit (this report) | branch tip after Phase 7F-B commits |
| `main` at branch creation | `eb0ca52` |
| Module Standard | `mms-v2.0.0` → `f85450d` (verify PASS) |
| Vault Notes | `vault-notes-v1.1.0` → `f443972` (verify PASS) |

Branch decision: `git merge-base --is-ancestor origin/phase7f-a-mac-ios-smoke origin/main` → **no** → branched from `origin/phase7f-a-mac-ios-smoke`.

## Expo UI

| Item | Value |
| --- | --- |
| Installed `@expo/ui` | `57.0.7` (declared `~57.0.7`; Doctor wants `~57.0.9` — **not upgraded**) |
| SDK | Expo `57.0.8` / Router `57.0.8` / RN `0.86.0` |
| Research map | `docs/research/phase7f-b-expo-ui-component-map.md` |
| Adapter home | `src/platform/ui/**` (extended; not a parallel `components/expo-ui` tree) |

### Adopted

- Universal Host + Button (existing), Switch, Checkbox, TextInput/SecureField bridge, List/FieldGroup, Progress
- Community `@expo/ui/community/segmented-control` for default `appearance="segmented"`
- Auth fields/buttons via adapters; SystemSwitch → ModulaSwitch
- Appearance Dim \| Dark \| OLED native segments when dark depth selected
- Activity All \| Mentions \| Modules segments
- Product Hub Discover \| Installed \| Updates segments

### Rejected / deferred

- Native Tabs / Stack.Toolbar (alpha; preserve shell)
- Feed-wide Host
- Replacing Story ring with SwiftUI
- Broad Settings → Expo UI List migration (partial only)

### Direct-import audit

- Product `src/features/**`, `src/auth/**`, `src/app/**`: no SwiftUI/Compose imports (verifier PASS)
- Platform adapters may import platform UI

## Stories

| Item | Detail |
| --- | --- |
| Original root cause | Block 11 emptied rail (`people=[]` → `null`); no API/query replacement — see `phase7f-b-stories-root-cause.md` |
| API | Greenfield `028_phase7f_stories` + `StoryService` + `/v1/stories*` |
| Local mirror | `src/api/local/routes/storyRoutes.ts` + LocalApiDatabase story store |
| Repository | `ApiStoriesRepository` |
| Rail | `useStoriesRailQuery` + Home wiring; authenticated Add Story fallback |
| Viewer / create | `/stories/create`, `/stories/[groupId]` |
| Expiry | Server-side 24h on Greenfield/local |
| Simulator evidence | Home Stories still **not reliably visible** in captured `05-home-with-stories.png` — HIGH open defect (layout/preferences/query timing) |

## Authentication

| Item | Detail |
| --- | --- |
| Environment | Local mutable API (`EXPO_PUBLIC_DATA_SOURCE=local`) — see `phase7f-b-dev-auth-environment.md` |
| Why not remote | `api.modula.digital` invite-only; Docker Desktop unavailable for local Postgres Greenfield |
| Registration | Create-account steps + ModulaCheckbox terms/privacy + handle availability |
| Verification / login / session | Existing SecureStore + SessionProvider paths; screens use Expo UI adapters |
| Demo | Demo session env empty; demo button remains for local only |
| Gaps | Full clean-install register→verify→login UI automation incomplete; Expo UI TextInput sizing on auth still weak visually |

## Browse

| Surface | Status |
| --- | --- |
| Home modes | Wired to real feed repository; native segmented intended (sticky still track) |
| Stories | API + create/viewer shipped; Home visibility **partial** |
| Composer | Opens; tool gating incomplete vs “hide dead tools” |
| Discover / Activity / Profile | Existing real repositories; Activity segments updated |
| Board / Product Hub / Vault Notes | Hub segments + search adapter; Vault Notes install/editor acceptance incomplete on local |
| Settings | Appearance switches/segments migrated; full native list Settings incomplete |

## Builds

| Gate | Result |
| --- | --- |
| Expo Doctor | WARNINGS only (duplicates / patch drift) — no SDK upgrade |
| CocoaPods | PASS |
| `expo run:ios` Debug | PASS (install + Metro + launch) |
| Xcode Debug | PASS (via expo run) |
| Xcode Release Simulator | PASS (`BUILD SUCCEEDED`) |
| Simulator journey | PARTIAL — launch, sign-in/create-account routes, home feed observed |

## Defects

| ID | Severity | Notes |
| --- | --- | --- |
| Stories rail not consistently visible on Home after login | HIGH | API + fallback landed; Simulator evidence still shows missing dial |
| Expo UI TextInput visual density on auth forms | MEDIUM | Labels present; native field chrome sizing weak |
| Sticky feed modes still RN track | MEDIUM | Intentional Host-in-overlay fallback |
| Nested tab name `index > index` | LOW | Pre-existing |
| Appearance local API route missing | MEDIUM | Local mirror lacks `/v1/accounts/me/appearance` |
| Composer shows tools that may be non-operational | MEDIUM | Camera/AI/etc. not fully gated |
| Docker Postgres Greenfield env | BLOCKER for remote-parity auth | Documented; used local API instead |
| Full screenshot set (26) | HIGH | Partial evidence only under `evidence/phase7f-b-native-product/` |
| Settings full Expo UI List migration | MEDIUM | Incomplete |
| Vault Notes native editor acceptance | HIGH | Incomplete this pass |

## Verifiers

`node scripts/verify-phase7f-b-native-product.mjs` → **8/8 PASS** (static).

## Verdict

**PARTIAL**

Phase 7F-B delivered the research gate, Expo UI adapter foundation, native segmented surfaces on key screens, Stories domain (Greenfield + local + client), auth UX improvements against a mutable local environment, Debug/Release Simulator builds, and static verifiers. It does **not** yet meet the full Definition of Done for clean-install journey, Stories visual acceptance, complete Settings/Vault Notes native product polish, or the full screenshot matrix.
