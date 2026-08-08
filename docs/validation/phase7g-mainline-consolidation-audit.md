# Phase 7G Mainline Consolidation Audit

Date: 2026-08-08
Audit branch: `phase7g-mainline-product-audit`
Product baseline: `origin/main`
Baseline commit: `f7a1902d856563ee2fbde302b5ecfdc87d645897`
Latest commit subject: `merge: bring Phase 7F-A and 7F-B into main`

## Source Gate

Commands run from `/home/andrei/modula-latest`:

| Check | Result |
| --- | --- |
| `git status --short --branch` after branch creation | `## phase7g-mainline-product-audit...origin/main` |
| `git remote -v` | `origin https://github.com/modula-mod/modula-latest.git` |
| `git fetch --all --tags --prune` | advanced `origin/main` and found `origin/phase7f-a-mac-ios-smoke`, `origin/phase7f-b-native-product-ui-auth-browse` |
| `git switch main && git pull --ff-only` | blocked because local `main` had diverged |
| Local-only commit on local `main` | `98d3474 docs: record phase 7e block 14 cutover evidence` |
| Audit branch creation | `git switch -c phase7g-mainline-product-audit origin/main` |
| Audit branch HEAD | `f7a1902d856563ee2fbde302b5ecfdc87d645897` |
| `origin/main` | `f7a1902d856563ee2fbde302b5ecfdc87d645897` |
| Working tree before audit docs/screenshots | clean |

The strict "local main equals origin/main" gate could not be satisfied without discarding a local-only commit on `main`. The audit therefore uses a new branch created directly from `origin/main` and treats GitHub `main` as canonical.

## Remote Branches And Tags

Remote branches after fetch:

| Ref | Role |
| --- | --- |
| `origin/main` | canonical product baseline |
| `origin/phase7f-a-mac-ios-smoke` | merged into `origin/main` by `f7a1902` |
| `origin/phase7f-b-native-product-ui-auth-browse` | merged into `origin/main` by `f7a1902` |

Recent consolidation tags:

| Tag | Meaning |
| --- | --- |
| `archive/pre-phase7e-main-20260801` | main before Phase 7E consolidation |
| `archive/pre-mainline-20260801/*` | archived historical branches before mainline consolidation |
| `archive/2026-07-21/phase1-social-shell` through `phase7a-greenfield-module-platform` | older historical snapshots |

`git log --graph --decorate --oneline --all -40` confirms:

- `f7a1902` merged Phase 7F-A and Phase 7F-B into `origin/main`.
- `97fc3ec` and `59d9fb7` merged Phase 7E platform and Block 14 work.
- The local-only `98d3474` is not part of `origin/main`.

## Historical Capability Accounting

Classification values: `PRESENT_IN_MAIN`, `SUPERSEDED`, `PARTIALLY_PRESENT`, `ACCIDENTALLY_LOST`, `INTENTIONALLY_REMOVED`, `UNKNOWN`.

| Capability | State | Evidence |
| --- | --- | --- |
| Social shell | `PRESENT_IN_MAIN` | `src/app/(tabs)`, `src/features/feed`, `src/features/social`, Phase 7C/7F verifiers mostly present. |
| Appearance runtime | `PRESENT_IN_MAIN` | `src/theme/runtime`, `src/features/settings/screens/AppearanceScreen.tsx`, `verify:theme` PASS. |
| Unified profile | `PRESENT_IN_MAIN` | `src/features/profile/screens/UnifiedProfileScreen.tsx`, profile routes under `src/app/profile` and `(tabs)/profile`. |
| Data/auth runtime | `PRESENT_IN_MAIN` | `src/auth/runtime/SessionProvider.tsx`, Greenfield `/v1/accounts/*` and `/v1/sessions*`. |
| Greenfield API | `PRESENT_IN_MAIN` | `services/greenfield-api`, migrations `001` through `028`, API inventory generated. |
| Module platform | `PRESENT_IN_MAIN` | `src/features/modules`, `services/greenfield-api/src/modules`, Phase 7E module verifiers pass except umbrella runtime drift. |
| Product Hub | `PARTIALLY_PRESENT` | Product and marketplace routes exist; registry has real lifecycle routes, but UI still exposes planned/placeholder products. |
| Vault Notes | `PARTIALLY_PRESENT` | External repo clean and release verified; host generic module route exists; live registry lookup by expected module id failed during audit. |
| Backend runtime | `PRESENT_IN_MAIN` | `services/greenfield-api` and `services/greenfield-worker` with module backend runtime verifiers PASS. |
| AI platform | `PRESENT_IN_MAIN` | `services/greenfield-api/src/ai`, AI provider/product verifiers PASS; product mode must not treat mock provider as usable. |
| AI provider runtime | `PRESENT_IN_MAIN` | `verify:phase7e-ai-provider-runtime` PASS. |
| AI product actions | `PRESENT_IN_MAIN` | `verify:phase7e-ai-product-integration` PASS; still gated by provider availability. |
| Standard 2 runtime | `PARTIALLY_PRESENT` | Specific Standard 2 verifiers PASS; umbrella `verify:phase7e-module-runtime-2` FAILS due rollback verifier drift after migration `028`. |
| Video/Reels | `PARTIALLY_PRESENT` | `src/features/reels`; live `/v1/reels` returns static preview-like entries and many actions are local previews. |
| Progressive blur | `PRESENT_IN_MAIN` | `src/platform/ui/navigation/progressive-blur-header-background.tsx`, shell bottom progressive blur. |
| Drawer | `PRESENT_IN_MAIN` | `src/shell/NavigationDrawer.tsx`, Phase 7F-A evidence docs, deep-link open timing fix merged. |
| Native shell | `PRESENT_IN_MAIN` | native tabs, liquid glass adapters, Expo UI adapter layer under `src/platform/ui`. |
| Mac fixes | `PRESENT_IN_MAIN` | Phase 7F-A commits merged; current Linux host cannot re-run Xcode proof. |

No historical area is left `UNKNOWN` after this checkpoint. The open problem is not missing merge history; it is product truth: several merged surfaces are partial, preview-only, environment-blocked, or not deployed on the live API.

## External Repository Integrity

### Module Standard

Path: `/home/andrei/modula-mod/modula-module-standard`

| Check | Result |
| --- | --- |
| Branch | `main` |
| Status | clean, `## main...origin/main` |
| HEAD | `2bfc0a826d19db870a445e06d52010cec6e0a54f` |
| `origin/main` | `2bfc0a826d19db870a445e06d52010cec6e0a54f` |
| Current package version consumed | `@modula/module-standard 2.0.0`, `@modula/module-sdk 2.0.0` |
| Current release tag | `mms-v2.0.0` |
| Standard 2 package checksum evidence | `/home/andrei/modula-mod/modula-module-standard/docs/releases/module-standard-2.0.0.md` |
| App references | mutable local `file:../modula-mod/modula-module-standard/packages/*` paths in root `package.json` |
| Production suitability | development-only until packages are checksum-pinned immutable artifacts |

### Vault Notes

Path: `/home/andrei/modula-mod/modula-vault-notes`

| Check | Result |
| --- | --- |
| Branch | `main` |
| Status | clean, `## main...origin/main` |
| HEAD | `4f2c3c9ef18a862ca4f896c3f59bf2e821b38c11` |
| `origin/main` | `4f2c3c9ef18a862ca4f896c3f59bf2e821b38c11` |
| Current release tag | `vault-notes-v1.1.0` |
| Module id in provenance | `modula.vault-notes` |
| Standard release in provenance | `mms-v1.2.0` |
| Release commit in provenance | `f443972d53f94b6f192a37bcce8742bdf18a99b5` |
| Package checksum | `46f918b07dc7d9c2734be4e6bb7729c137d316ceaa3f9d272da1bd7f78ad253a` |
| Manifest checksum | `aa8b09bcde62a7415d46c85b597b2c632ebde14e65a85481b0244ba40d642af5` |
| Greenfield manifest checksum | `d674b65a66bc5a671dc43ef2f8883d2faabc02b34c7c52d5c80162df9f661cfb` |
| Production suitability | release artifact exists; host consumption still depends on registry state and mutable local Standard packages |

## Consolidation Verdict

Mainline consolidation appears structurally intact: the major historical codepaths are reachable from `origin/main`, and the Phase 7F merge is visible at the graph tip. Product readiness is not intact. The merged main branch contains a mixture of working systems, preview-only UI, stale live API deployment, verifier drift, and product surfaces that still expose future concepts as if they are current.
