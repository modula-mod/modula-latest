# Phase 7M-B8 — Source baseline (Gate A)

**Phase:** 7M-B8 Founder Mockup Reconstruction  
**Recorded:** 2026-08-21  
**Gate:** A — baseline only (no UI source edits at time of capture)  
**7M-C:** NOT AUTHORISED  
**FOUNDER VISUAL APPROVAL:** REQUIRED (not claimed)

## Git identity

| Field | Value |
| --- | --- |
| Repo | `modula-mod/modula-latest` (`https://github.com/modula-mod/modula-latest.git`) |
| Remotes | `origin`, `vps-modula` (`modula-vps:/root/modula-latest`) |
| LOCAL_HEAD (at Gate A start) | `d81d2c9e544fc0ece22b8299441d9172cc6d159f` on `cursor/full-route-screenshots-99cd` |
| ORIGIN_MAIN | `fcca100137526ff44892ba1b2870238d11b78834` |
| ACTIVE_PHASE_BRANCH (created for B8) | `cursor/phase7m-b8-founder-mockup-reconstruction` |
| ACTIVE_PHASE_SHA (branch base) | `9bde9e7ec7ec7d844fca8749c145eff75d72ea8b` (= tip of `origin/cursor/phase7m-b7-full-route-post-v2`) |
| LATEST_PHASE7M_REF | `origin/cursor/phase7m-b7-full-route-post-v2` @ `9bde9e7…` |
| Untracked at start | `docs/validation/evidence/phase7m-b6/screenshots-profile-masterpiece/tabs-morph-flush.png` |

**Decision:** Do **not** branch from `main`. B8 continues the Phase 7M line from **B7** (`cursor/phase7m-b7-full-route-post-v2`), which already contains Post V2 + full-route hardening.

## Production (read-only discovery)

| Field | Value |
| --- | --- |
| Web current | `/var/www/modula/releases/f0da1c1d707f262687ee35284d2721c98f32e2e5` |
| Web CURRENT_SHA | `f0da1c1d707f262687ee35284d2721c98f32e2e5` (B7 immersive media commit) |
| VPS repo HEAD (at probe) | `e5d4b946fdf80fb82f0ae0963bdd3a087ff5e97a` (B7 evidence docs tip) |
| Documented B7 web deploy | `docs/validation/phase7m-b7-production-deployment.md` — web `f0da1c1…`, API/worker `e5d4b946…` |
| Rollout policy for B8 | WEB-ONLY after FINAL_PRODUCT_SHA; **DATABASE MIGRATION = NONE** |

## Installed stack (package.json ranges)

| Package | Range / version |
| --- | --- |
| expo | `~57.0.15` |
| react-native | `0.86.2` |
| expo-router | `~57.0.15` |
| @expo/ui | `~57.0.12` |
| react-native-reanimated | `4.5.1` |
| react-native-gesture-handler | `~2.32.0` |
| expo-image | `~57.0.3` |
| expo-video | `~57.0.2` |
| expo-blur | `~57.0.2` |
| expo-glass-effect | `~57.0.1` |
| @shopify/react-native-skia | `2.6.2` |
| @shopify/flash-list | **NOT INSTALLED** |

**Policy:** No Expo/RN upgrades in B8. Patch mismatches reported by tooling are **documented, not fixed by upgrade**.

## `pnpm exec expo install --check`

Exit code **1**. Outdated relative to Expo’s expected patch set (examples):

- `@expo/metro-runtime` 57.0.9 vs expected ~57.0.12  
- `@expo/ui` expected patch drift vs installed  
- `expo` / `expo-router` / `expo-image` / related patch bumps suggested  

**Action:** Record only. Do **not** upgrade to “fix” doctor.

## `pnpm exec expo-doctor`

Exit code **1**. **2/20** failed:

1. Non-CNG native folders + `app.config.ts` fields that Prebuild would sync (`scheme`, `orientation`, icons, plugins, …).  
2. Package version mismatches (same family as `--check`).

**Action:** Document. No speculative dependency churn.

## Vault Notes registry truth (read-only)

| Field | Value |
| --- | --- |
| Canonical module ID | `digital.modula.vault-notes` |
| Contracts candidate version | `1.1.0` (`CANONICAL_VAULT_NOTES_CURRENT_VERSION`) |
| Historical registry version in contracts | `0.2.0` |
| Live `GET /v1/registry/modules/digital.modula.vault-notes` | **published `latestVersion`: `0.2.0`** |
| Live versions list | includes `0.2.0` release; **1.1.0 not present on live registry at Gate A** |

**B8 rule:** Product Hub / detail must use **truthful registry data**. Do **not** invent App Store ratings/downloads. Candidate `1.1.0` may appear as **candidate / not yet published** copy only — never as fake live install metrics.

## Existing engineering to preserve (functional spec)

- Post V2 under `src/features/social/posts/` (shell, action rail, reaction picker, context menu, comments sheet, media renderers).  
- Product Hub: `ProductHubMarketplaceScreen` + module detail routes.  
- Auth: welcome / sign-in / OTP already present.  
- Settings security: sessions + password; **no App Lock / PIN / pattern / biometric unlock UI yet** (SecureStore session storage only).  
- Verifiers: `verify:phase7m-b`, `-b3-evidence`, `-b6`, `-b7` (+ web). **B8 verifier to add.**

## Dirty tree / evidence preserved

- Keep `tabs-morph-flush.png` (B6 profile masterpiece).  
- Founder mockups copied to `docs/validation/evidence/phase7m-b8/founder-mockups/` (28 PNGs).  
- Do not `git reset` / discard Phase evidence.

## Gate A status

**COMPLETE** — baseline recorded; stack frozen; production SHA discoverable; B8 branch rooted on B7.
