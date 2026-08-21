# Phase 7M-B9 — Product Hub source baseline

**Recorded:** 2026-08-21  
**Mission:** Product Hub / Marketplace exact reconstruction  
**Founder visual approval:** REQUIRED  
**Production rollout:** NOT AUTHORISED  
**Database migration:** NONE  
**7M-C:** NOT AUTHORISED

## Checkouts and repositories

| Field | Value |
| --- | --- |
| Canonical Mac checkout | `/Users/msjoy/Developer/modula-latest` |
| Active clean B9 worktree | `/Users/msjoy/Documents/Codex/2026-08-21/modula-phase-7m-b9-product-hub` |
| VPS checkout | `/root/modula-latest` via `ssh modula-vps` |
| Product repository | `https://github.com/modula-mod/modula-latest` |
| Vault Notes repository | `https://github.com/modula-mod/modula-vault-notes` |
| Evidence repository | `https://github.com/modula-mod/modula-evidence-screenshots` |

The canonical checkout was deliberately not cleaned or switched because it contained unrelated founder work:

- modified `ios/Podfile.lock`;
- untracked `docs/validation/evidence/phase7m-b8/metro-entry-fix-iphone17pro.png`.

The dedicated B9 worktree preserves both files untouched.

## Git baseline

| Field | Value |
| --- | --- |
| `LOCAL_HEAD` at B9 creation | `ff6324f4720e071535b46930014198994e86c8ca` |
| `ORIGIN_MAIN` | `fcca100137526ff44892ba1b2870238d11b78834` |
| Base branch | `origin/cursor/phase7m-b8-founder-mockup-reconstruction` |
| Base SHA | `ff6324f4720e071535b46930014198994e86c8ca` |
| B9 branch | `cursor/phase7m-b9-product-hub-exact-reconstruction` |
| Latest cumulative Phase 7M branch | `origin/cursor/phase7m-b8-founder-mockup-reconstruction` |
| Latest cumulative Phase 7M SHA | `ff6324f4720e071535b46930014198994e86c8ca` |

### Remote-branch classification

| Ref | Classification | Reason |
| --- | --- | --- |
| `origin/cursor/phase7m-b8-founder-mockup-reconstruction` | `LATEST_CUMULATIVE_UI` | Contains B7 plus B8 App Lock, module identity, registry honesty, and Phase 7M skill updates. |
| `origin/cursor/phase7m-b7-full-route-post-v2` | `OLDER_UI` | Parent line of B8. |
| `origin/cursor/full-route-screenshots-99cd` | `OLDER_UI` | Evidence-tour branch predating B7/B8. |
| `origin/main` | `ALREADY_INTEGRATED` | Ancestor of the cumulative B8 branch, but not its tip. |

No pre-existing local or remote B9 branch was present after `git fetch origin --tags --prune`.

## Product Hub implementation map

| Responsibility | Canonical source |
| --- | --- |
| Product Hub landing/search composition | `src/features/modules/screens/ProductHubMarketplaceScreen.tsx` |
| Dynamic module detail route | `src/app/marketplace/[moduleId].tsx` |
| Module detail composition | `src/features/marketplace/screens/ModuleDetailScreen.tsx` |
| Editorial presentation components | `src/features/modules/components/presentation/` |
| Module artwork contract | `src/features/modules/components/ModuleArtwork.tsx` |
| Artwork identity data | `src/features/modules/identity/moduleArtwork.ts` |
| Install review | `src/features/modules/components/InstallPreviewSheet.tsx` |
| Install progress | `src/features/modules/components/ModuleInstallProgress.tsx` |
| Search state machine | `src/features/modules/state/productHubSearchMachine.ts` |
| Product Hub repository queries | `src/features/modules/hooks/useModuleQueries.ts` |
| Authenticated API repository | `src/data/repositories/api/ApiModuleRepository.ts` |
| Generic module host | `src/features/modules/runtime/module-host.tsx` |
| Existing UI Lab | `src/platform/ui/dev/expo-ui-lab/` |
| Theme / Appearance / Surface owners | `src/theme/`, `src/components/materials/`, `src/components/primitives/Surface.tsx` |
| Semantic platform adapters | `src/platform/ui/` |

No second UI package or parallel API client is authorised.

## Installed Expo stack

Resolved from the installed canonical checkout on 2026-08-21:

| Package | Resolved |
| --- | --- |
| Expo SDK | `57.0.15` (`sdkVersion 57.0.0`) |
| React | `19.2.3` |
| React Native | `0.86.2` |
| React Native Web | `0.21.2` |
| Expo Router | `57.0.15` |
| `@expo/ui` | `57.0.12` |
| Reanimated | `4.5.1` |
| Gesture Handler | `2.32.0` |
| expo-image | `57.0.3` |
| expo-video | `57.0.2` |
| expo-blur | `57.0.2` |
| expo-glass-effect | `57.0.1` |

`@expo/ui` resolved to the installed `57.0.12` package with git head `499024a441d67293aa60afcbe02051999a54f1bb`. Its package exports, universal definitions, SwiftUI definitions, Jetpack Compose definitions, relevant modifiers, and existing Modula adapters were inspected before implementation. Product screens remain forbidden from importing platform-specific Expo UI packages directly.

## Expo diagnostics at baseline

| Command | Truthful result |
| --- | --- |
| `pnpm exec expo config --type public` | PASS; iOS, Android, and web; development client configured; static web output. |
| `pnpm exec expo install --check` | EXIT 1; pre-existing `expo-local-authentication@16.0.5`, expected `~57.0.2`. |
| `pnpm exec expo-doctor` | EXIT 1; 18/20 checks pass. Non-CNG config sync warning plus the same local-authentication version mismatch. |

B9 records these pre-existing warnings and does not automatically remediate them.

## Vault Notes source and release truth

| Field | Value |
| --- | --- |
| Visible canonical product | `Vault Notes` |
| Canonical module ID | `digital.modula.vault-notes` |
| Canonical source | `modula-mod/modula-vault-notes` |
| Canonical source HEAD | `d92e445` (`feat: declare canonical module ID digital.modula.vault-notes`) |
| Verified source release | `1.1.0` |
| Verified tag | `vault-notes-v1.1.0` |
| Tag commit | `f443972d53f94b6f192a37bcce8742bdf18a99b5` |
| Live registry release | `0.2.0` |
| Live registry state | published / available / first party |
| Live registry source | `modula-mod/modula-module-vault-notes` @ `54ab8ed…` (stale legacy record) |

The product UI must not collapse these into a false single claim. The install CTA acts on the live registry release. Canonical source/release lineage may be disclosed under Source or Trust & Technical Details. The legacy repository is archive/redirect only and must not appear as a second product.

## Production read-only baseline

| Field | Value |
| --- | --- |
| VPS inspected | YES, via `ssh modula-vps` |
| VPS repository HEAD | `e5d4b946fdf80fb82f0ae0963bdd3a087ff5e97a` |
| Production web target | `/var/www/modula/releases/ff6be1b722c1974cf0f0093adfc5af95165f9d96` |
| Production web SHA | `ff6be1b722c1974cf0f0093adfc5af95165f9d96` |
| Production API SHA | `e5d4b946fdf80fb82f0ae0963bdd3a087ff5e97a` (current documented/runtime checkout identity) |
| Production worker SHA | `e5d4b946fdf80fb82f0ae0963bdd3a087ff5e97a` (current documented/runtime checkout identity) |
| Production module ID | `digital.modula.vault-notes` |
| Production version | `0.2.0` |
| Production publisher | `Modula` / `modula` |
| Production installability | `available` |
| Production source | stale legacy registry record; see Vault Notes truth above |
| Production modified | NO |
| Production deployed | NO |

## Baseline gate

**PASS** — B9 is based on the latest cumulative UI branch, the canonical checkout's unrelated changes are preserved, the SDK 57 surface is verified, Vault Notes source and live-registry truth are separated, and production remains inspect-only.
