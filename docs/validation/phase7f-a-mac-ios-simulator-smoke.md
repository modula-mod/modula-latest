# Phase 7F-A — Mac iOS Simulator Smoke Report

**Date:** 2026-08-04  
**Workspace:** `/Users/msjoy/Developer/modula-ios-smoke/modula-latest`  
**Mac branch:** `phase7f-a-mac-ios-smoke`  
**Policy:** No production deploy/migrations, no TestFlight, no Expo SDK upgrade, no Standard 2 fabric, no broad redesign.

## Verdicts

| Pass | Verdict | Notes |
| --- | --- | --- |
| **Pass A** — consolidated `main` smoke | **PASS_WITH_NON_BLOCKING_ISSUES** | App builds, installs, launches on Simulator via development client; Greenfield reachable; shell/auth entry smoke completed with focused fixes. Non-blocking issues listed below. |
| **Pass B** — consolidated `main` retest | **PASS_WITH_NON_BLOCKING_ISSUES** | `origin/main` unchanged at `eb0ca524a86872e3e9a467bf5e582d06a3ce8119` after fetch; Pass B same tip as Pass A (Block 14 already merged). No separate clean worktree retest required while tip is identical. |

Exact verdict tokens used: `PASS_WITH_NON_BLOCKING_ISSUES`.

---

## Source

| Item | Value |
| --- | --- |
| Pass A / Pass B commit | `eb0ca524a86872e3e9a467bf5e582d06a3ce8119` (`origin/main`) |
| Block 14 at build time | **Complete** on `main` |
| Standard (`modula-module-standard`) | `main` `2bfc0a8` · tag `mms-v2.0.0` → `f85450d` |
| Vault Notes | `main` `4f2c3c9` · tag `vault-notes-v1.1.0` → `f443972` |
| Adjacent packages | `../modula-mod/modula-module-standard`, `../modula-mod/modula-vault-notes` |

See also: `phase7f-a-mac-source-provenance.md`.

---

## Environment

| Item | Value |
| --- | --- |
| macOS | 27.0 (Build 26A5378n), Apple Silicon |
| Xcode | 26.6 (17F113) |
| Simulator | iPhone 17 Pro · iOS 26.5 · UDID `439E8DF1-EA4F-4028-98A0-32CA9469EAE0` |
| Node / pnpm / CocoaPods | v22.21.0 / 11.3.0 / 1.16.2 |
| Backend | Remote Greenfield `https://api.modula.digital` (`preview`, `inviteOnly: true`) |

See also: `phase7f-a-mac-toolchain.md`, `phase7f-a-pinned-stack.md`.

---

## Build

| Gate | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | **PASS** |
| Module Standard / Vault Notes verify | **PASS** (vault-notes DB verifier **BLOCKED** — needs PostgreSQL) |
| App typecheck | **PASS** |
| Lint | **WARNING** (api-contracts export resolver) |
| Expo Doctor | **WARNING** only (no blockers; no SDK upgrade) |
| Native ownership | `ios/` **tracked** — no `prebuild --clean` |
| `pod install` | **PASS** |
| `expo run:ios` Debug | **PASS** (install + launch + Metro) |
| Independent Xcode Debug | **PASS** |
| Development client (not Expo Go) | **PASS** — `exp+modula` scheme + Metro `127.0.0.1:8081` |
| Release-configuration Simulator compile | **PASS** (`xcodebuild` Release → `** BUILD SUCCEEDED **`) |

### Native config fixes (Mac branch)

1. Target `IPHONEOS_DEPLOYMENT_TARGET` → `16.4` (was RECOMMENDED → 15.0).
2. `ENABLE_USER_SCRIPT_SANDBOXING = NO`.
3. `Podfile.properties.json` `ios.deploymentTarget: 16.4`.
4. `exp+modula` URL scheme in `Info.plist`.
5. Privacy strings synced into `Info.plist` + `app.config.ts` `ios.infoPlist` (`NSCameraUsageDescription`, photo library keys) — Appearance Advanced was fatalling without camera usage text.
6. Explicit `babel-preset-expo` in package root for Release `export:embed` resolution under pnpm.

---

## Authentication

| Case | Result |
| --- | --- |
| Cold / signed-out entry | **PASS** — `/sign-in` and welcome paths render (`02-login.png`) |
| Session restore | **PASS** — SecureStore restored Andrei session after relaunch (**SIMULATOR_VERIFIED** only; not physical Keychain acceptance) |
| Invalid credentials (API) | **PASS** — `POST /v1/sessions` with unknown email/password → `UNAUTHENTICATED` / `Invalid credentials` (`requestId` captured locally, not committed) |
| Invalid credentials (UI handling) | **FIXED** — see defect below |
| Valid login with new invite account | **BLOCKED / not completed** — `inviteOnly: true`; no smoke credentials invented or committed |
| Registration | **BLOCKED** by invite-only policy on this environment |
| Logout | **PARTIAL** — Session Lab / account Sign out paths present; UI automation limited without Assistive Access |
| Backend unavailable | Not force-injected; live/ready/meta **OK** during smoke |

### Defect: uncaught `ModulaApiError: Invalid credentials`

| Field | Detail |
| --- | --- |
| Severity | Non-blocking for shell smoke; noisy console / RedBox risk |
| Reproduction | Open Session Lab (`/settings/developer/session`) or tap “Use development demo account” while `EXPO_PUBLIC_DATA_SOURCE=remote` against Greenfield |
| Expected | Handled UI error; no uncaught promise |
| Actual | Local demo passwords (`andrei@modula.local` / `modula-local-password`) correctly rejected by Greenfield as `Invalid credentials`, but `void continueAsDemo(...)` in Session Lab left the rejection uncaught. Metro showed this immediately after navigating to Session Lab. |
| Classification | **Not** bootstrap/session-restore auto-login (demoSession was empty/`signedOut`; restore used refresh token successfully). **Expected API rejection** for remote demo passwords + **missing UI/error handling**. |
| Root cause | Session Lab fired `continueAsDemo` without `.catch`; Sign-in demo path swallowed errors silently. |
| Fix status | **Fixed** on Mac branch — `continueAsDemo` maps `UNAUTHENTICATED` to a clear Error; Sign-in and Session Lab surface it in UI. Regular Sign-in `submit()` already caught invalid passwords. |
| Blocking? | No |

---

## Product / shell smoke

| Surface | Result |
| --- | --- |
| First route / Home shell | **PASS** after duplicate-tab fix |
| Tabs (liquid glass + plus compose) | **PASS** |
| Discover / Activity / Profile | **PASS** (deep link / tab chrome) |
| Board | **PASS** (route reachable; hidden tab registration) |
| Drawer | **PASS** — opened via `__DEV__` deep link `modula:///?openDrawer=1` (Assistive Access blocked raw taps) |
| Settings | **PASS** |
| Product Hub | **PASS** (empty registry view: “No modules currently match”) |
| Module host `/module/modula.vault-notes` | **PASS** (honest unavailable: not in registry for account) |
| Vault Notes settings/search | **PARTIAL** — host routes resolve to unavailable state (no crash) |
| Appearance modes | **PARTIAL** — Appearance screen renders with System/Light/Dim/Dark/OLED options; OLED toggle not exercised end-to-end (no AX) |
| Fast Refresh | **PASS** after Metro restart without `CI=1` |

### Defect: duplicate `create` tab registration (blocker → fixed)

| Field | Detail |
| --- | --- |
| Severity | Launch blocker (Render Error) |
| Reproduction | Open tabs navigator with liquid-glass path |
| Expected | Unique screen names |
| Actual | `Screen names must be unique: index,discover,create,activity,profile,create` |
| Root cause | `LiquidGlassPlatformTabs` mapped `MODULA_TABS` (includes `create`) **and** added a second `<Tabs.Screen name="create" />` |
| Fix | Removed duplicate; `create` uses `href: null`; declared hidden `board` screen |
| Blocking? | Was yes → **fixed** |

---

## Greenfield connectivity

| Check | Result |
| --- | --- |
| `/v1/health/live` | OK |
| `/v1/health/ready` | OK |
| `/v1/meta` | OK — `inviteOnly`, module registry capabilities present; top-level `modules: false` |
| Authenticated feed/profile | Observed against restored session (public/owner surfaces) |
| Module registry install of Vault Notes | Unavailable for current account (honest empty/unavailable UI) |

---

## Evidence

Directory: `docs/validation/evidence/phase7f-a-ios-simulator/`

| File | Content |
| --- | --- |
| `01-launch.png` | Settled Home shell after first-route fix |
| `02-login.png` | Sign-in screen |
| `03-authenticated-home.png` | Authenticated / restored Home feed |
| `04-drawer.png` | Navigation drawer open (`openDrawer=1` smoke deep link) |
| `05-settings.png` | Settings |
| `06-product-hub.png` | Product Hub |
| `07-vault-notes.png` | Module host unavailable state |
| `08-profile.png` | Profile |
| `09-light.png` | Appearance screen (light/system modes visible) |
| `10-oled.png` | Appearance screen capture (OLED mode option present; not fully toggled) |
| `11-error-state.png` | Module unavailable / Retry |

Sanitized logs (local only, gitignored): `.local-evidence/phase7f-a/`  
(`metro-*.log`, `xcode-*-build.log` — no tokens committed).

---

## Defects summary

| ID | Severity | Status |
| --- | --- | --- |
| Duplicate `create` Tabs.Screen | Blocker | **Fixed** |
| Missing camera/photo Info.plist keys | Blocker when opening Appearance Advanced | **Fixed** |
| Uncaught Invalid credentials from remote demo login | Non-blocking | **Fixed** (UI handling) |
| Nested tab name warning `index > index` | Non-blocking | Open |
| Product Hub empty / Vault Notes unavailable on this Greenfield account | Environment | Documented |
| Profile posts surface “Could not load” | Non-blocking | Open |
| Invite-only blocks new registration / valid-login invent | Environment | Documented |
| Drawer/OLED UI automation without Assistive Access | Tooling | Partial evidence |

---

## Commits expected on Mac branch

Focused commits only (messages):

- `fix: remove duplicate create tab registration`
- `fix: sync iOS privacy usage strings for camera/photos`
- `fix: handle remote demo sign-in Invalid credentials in UI`
- `build: pin iOS deployment target and disable user script sandboxing`
- `docs: record Phase 7F-A Mac iOS simulator smoke results`

(Actual commit set may collapse closely related native/docs changes.)

---

## Integration note

Branch pushed as `phase7f-a-mac-ios-smoke` for PR against final `main`. Do not force-push. Do not merge while documenting; open focused PR after review.
