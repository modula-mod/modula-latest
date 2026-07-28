# Phase 7C Starting Baseline

Date: 2026-07-26
Canonical repository: `/home/andrei/modula-latest`
Phase branch: `phase7c-modula-product-realisation`

## Source Control Gate

Commands run before creating the phase branch:

- `git status --short` -> clean
- `git branch --show-current` -> `main`
- `git rev-parse HEAD` -> `e0bd75ab1aad294ef4e1a2e3244c999ddbc23f23`
- `git fetch origin --prune --tags` -> no output
- `git ls-remote --heads origin` -> only `refs/heads/main`, pointing at `e0bd75ab1aad294ef4e1a2e3244c999ddbc23f23`

Branch creation:

- `git switch main` -> already on `main`
- `git pull --ff-only origin main` -> already up to date
- `git switch -c phase7c-modula-product-realisation`
- `git push --set-upstream origin phase7c-modula-product-realisation`

## VPS Runtime

Greenfield API:

- Container: `modula-preview-greenfield-api-1`
- Image tag: `modula-preview-greenfield-api:latest`
- Image ID: `sha256:1fe7ee3616ae779acb55d213966bce95d678ca7c315dbbb758055c167c725ed5`
- Image created: `2026-07-26T02:20:55.026769223+01:00`
- Started: `2026-07-26T01:21:16.515512674Z`
- Status: running, healthy
- Port: `127.0.0.1:4020->4020/tcp`

Greenfield Worker:

- Container: `modula-preview-greenfield-worker-1`
- Image tag: `modula-preview-greenfield-worker:latest`
- Image ID: `sha256:6c5e7eee2638ab3a4bbf1c47f39da8947bcff45dc74c915b0d02cf7de3307854`
- Image created: `2026-07-26T02:20:39.948832119+01:00`
- Started: `2026-07-26T01:21:32.289337013Z`
- Status: running

Database:

- Container: `modula-preview-greenfield-postgres-1`
- Image: `postgres:16.9-alpine`
- Status: running, healthy
- Port: `127.0.0.1:5433->5432/tcp`

Public API smoke:

- `curl -fsS https://api.modula.digital/v1/meta` -> `ok:true`
- Backend: `greenfield`
- Environment: `preview`
- API version: `v1`
- Protocol version: `0.1`
- Server time observed: `2026-07-26T11:35:31.485Z`

## Database Migration

Command:

- `set -a; source services/greenfield-api/.env >/dev/null 2>&1; set +a; pnpm --filter @modula/greenfield-api db:status`

Applied migrations:

- `001_init_schema`
- `002_phase6_social_atproto`
- `003_phase6_api_rls_writes`
- `004_greenfield_sovereign_core`
- `005_greenfield_backup_access`
- `006_phase6s_social_product`
- `007_phase6s_backfill_counts_and_defaults`
- `008_phase6s_comment_reply_counter_consistency`
- `009_phase7a_module_platform`
- `010_phase7b_module_runtime`

Pending migrations: `[]`

## Current Web Release

Public web:

- `curl -I -fsS https://modula.digital` -> HTTP 200
- Active symlink: `/home/andrei/deployments/modula-web/current`
- Active target: `/home/andrei/deployments/modula-web/releases/20260726T010928Z`

`/home/andrei/deployments/modula-web/current/release.json`:

- Commit: `00bb121384b181873b9bf58914731bd2379118ba`
- Branch: `phase7b-greenfield-module-host`
- Built at: `2026-07-26T01:08:44Z`
- Asset cache buster: `00bb121384b1-20260726T010844Z`
- Environment: `preview`
- Data source: `remote`
- API URL: `https://api.modula.digital`
- API version: `v1`
- Protocol version: `0.1`

## Vault Notes Release

External repository:

- Path: `/home/andrei/modules/modula-module-vault-notes`
- Branch: `phase0-2-declarative-vault`
- HEAD: `54ab8edac1ba469f0081c636e11f6059d712becc`
- Manifest: `/home/andrei/modules/modula-module-vault-notes/module.manifest.json`
- Package: `@modula-mod/vault-notes-module`
- Version: `0.2.0`
- Module ID: `digital.modula.vault-notes`
- Trust: `firstParty`
- Product state: `Declarative 0.2.0`
- Privacy label: `Private in Modula`
- Lifecycle execution mode: `declarative`
- Functions: contract-only, reviewed handlers required
- Profile tab: owner-only and disabled by default
- Board contributions: launcher and recent-summary
- Manifest SHA-256: `333914ecc4393aba2d10d23754636e061e46a1b1033cdac1e6002599693ef898`
- Release SHA-256: `39df3ec1064869e19a58a8714b2d2d1955778c065ce1bed514b56fdd75c7db1c`

## Feature Flags

Observed from `https://api.modula.digital/v1/meta`:

| Capability | State |
| --- | --- |
| `publicRead` | true |
| `authentication` | true |
| `mutations` | true |
| `mediaUpload` | false |
| `atproto` | false |
| `modules` | false |
| `atprotoOAuth` | false |
| `atprotoPublishing` | false |
| `atprotoImport` | false |
| `pdsPilot` | false |
| `greenfieldAccounts` | true |
| `greenfieldSessions` | true |
| `greenfieldRepositories` | true |
| `greenfieldExtensions` | true |
| `greenfieldModuleRegistry` | true |
| `greenfieldModuleInstallation` | true |
| `greenfieldModuleDeclarativeContributions` | true |
| `greenfieldModuleFirstPartyExecution` | true |
| `greenfieldModuleRemoteFunctions` | false |
| `greenfieldModuleCommunityExecution` | false |
| `greenfieldModuleGithubSync` | false |
| `greenfieldVaultNotesReference` | true |
| `greenfieldDimon` | false |
| `inviteOnly` | true |
| `atprotoBridgeOptional` | true |

Feature flag environment names in `services/greenfield-api/src/config/env.ts`:

- `MODULA_ATPROTO_ENABLED`
- `MODULA_INVITE_ONLY`
- `MODULA_PREVIEW_WRITES_ENABLED`
- `MODULA_RATE_LIMIT_ENABLED`
- `MODULA_PDS_PILOT_ENABLED`
- `GREENFIELD_MODULE_REGISTRY_ENABLED`
- `GREENFIELD_MODULE_INSTALLATION_ENABLED`
- `GREENFIELD_MODULE_DECLARATIVE_CONTRIBUTIONS_ENABLED`
- `GREENFIELD_MODULE_FIRST_PARTY_EXECUTION_ENABLED`
- `GREENFIELD_MODULE_REMOTE_FUNCTIONS_ENABLED`
- `GREENFIELD_MODULE_COMMUNITY_EXECUTION_ENABLED`
- `GREENFIELD_MODULE_GITHUB_SYNC_ENABLED`
- `GREENFIELD_VAULT_NOTES_REFERENCE_ENABLED`
- `GREENFIELD_DIMON_ENABLED`

## Lint Baseline

Command:

- `pnpm lint`

Result:

- `expo lint`
- `48 problems (0 errors, 48 warnings)`
- `0 errors and 29 warnings potentially fixable with the --fix option`

Warning families:

- duplicate imports in `src/app/_layout.tsx` and `src/data/repositories/contracts/AuthRepository.ts`
- unused variables/imports in session, decoding, product, profile, social, platform UI files
- hook dependency warning in `src/features/activity/screens/ActivityScreen.tsx`
- `Array<T>` style warnings in product data/screens and web tab rail

## Current Route Inventory

Root app groups and primary files:

- `src/app/_layout.tsx`
- `src/app/+not-found.tsx`
- `src/app/(auth)/*`
- `src/app/(tabs)/*`
- `src/app/account/*`
- `src/app/collections/*`
- `src/app/communities/*`
- `src/app/creator/*`
- `src/app/discover/*`
- `src/app/help/*`
- `src/app/lists/*`
- `src/app/marketplace/*`
- `src/app/messages/*`
- `src/app/module/[moduleId]/*`
- `src/app/oauth/atproto.tsx`
- `src/app/post/*`
- `src/app/product/*`
- `src/app/profile/*`
- `src/app/reels/*`
- `src/app/settings/*`
- `src/app/compose.tsx`
- `src/app/drafts.tsx`
- `src/app/modules.tsx`
- `src/app/reactions.tsx`
- `src/app/report.tsx`
- `src/app/saved.tsx`
- `src/app/share-profile.tsx`
- `src/app/share.tsx`
- `src/app/teams.tsx`
- `src/app/whats-new.tsx`

Auth routes:

- `welcome`, `create-account`, `register`, `verify-email`, `onboarding`, `sign-in`, `forgot-password`, `recover`, `reset-password`

Current tab group:

- `index`
- `discover`
- `board`
- `activity`
- `profile`
- hidden route file `create`

Current route concern:

- `Board` is a permanent root tab in `src/platform/ui/navigation/modula-tabs.ts`.
- `Create` is not a visible root destination; `src/app/(tabs)/create.tsx` is hidden.
- Product and marketplace naming is mixed across `/product`, `/marketplace`, `/modules`, and Settings module routes.
- There are many preview/lab/product routes under `/product/*`, including DIMON/NFT/Gaia/Gubic-adjacent placeholders that must remain out of the normal Founder Alpha IA.

## Native Dependencies And Config

Pinned package versions:

- `expo`: `~57.0.8`
- `expo-router`: `~57.0.8`
- `@expo/ui`: `~57.0.7`
- `react-native`: `0.86.0`
- `react`: `19.2.3`
- `react-dom`: `19.2.3`
- `expo-dev-client`: `~57.0.9`
- `expo-glass-effect`: `~57.0.1`
- `expo-camera`: `~57.0.3`
- `expo-image-picker`: `~57.0.6`
- `expo-video`: `~57.0.2`
- `expo-secure-store`: `~57.0.1`
- `@callstack/liquid-glass`: `^0.8.0`
- `react-native-screens`: `4.26.2`
- `react-native-gesture-handler`: `~2.32.0`
- `react-native-reanimated`: `4.5.0`
- `react-native-safe-area-context`: `~5.7.0`
- `react-native-worklets`: `0.10.0`

Native project files present:

- `ios/Modula.xcodeproj/project.pbxproj`
- `ios/Modula/Info.plist`
- `ios/Podfile`
- `android/app/build.gradle`
- `android/build.gradle`

App config:

- App name: `Modula`
- Slug: `modula`
- Scheme: `modula`
- Version: `0.1.0`
- iOS bundle identifier: `digital.modula.app`
- Android package: `digital.modula.app`
- Orientation: portrait
- User interface style: automatic
- Updates: disabled
- Typed routes: enabled

Declared plugins:

- `expo-router`
- `expo-dev-client` with `toolsButton:false`
- `expo-image-picker`
- `expo-camera`
- `expo-video`
- `expo-secure-store`
- `expo-splash-screen`

EAS profiles:

- `development`
- `development-simulator`
- `preview`
- `production`

## Module Providers And Runtime Boundary

Current host module surfaces:

- `src/features/modules/runtime/module-host.tsx`
- `src/features/modules/screens/ModuleHostScreen.tsx`
- `src/features/modules/screens/ProductHubMarketplaceScreen.tsx`
- `src/data/repositories/api/ApiModuleRepository.ts`
- `src/data/repositories/api/ApiToolsRepository.ts`
- routes under `src/app/module/[moduleId]/*`
- Product Hub and module management under `/marketplace`, `/modules`, and `/settings/modules`

Current external module proof:

- Vault Notes `digital.modula.vault-notes` `0.2.0`
- Declarative views and schemas only
- No host-owned Vault Notes implementation under `src/features/vault-notes`
- No arbitrary remote JavaScript execution

Operational provider posture to preserve:

- `modula.declarative-ui`
- `modula.records`
- `modula.actions`
- `modula.functions`

Inactive metadata-only provider posture to preserve:

- `modula.automation`
- `modula.document`
- `modula.media`
- `modula.gaia`
- `modula.game-lite`
- `modula.web-games`
- `modula.godot-runtime`
- `modula.unity-runtime`
- `modula.spatial`

Baseline note: a direct named engine-provider registry was not found in the initial text search. Phase 7C must either preserve the existing Phase 7B runtime contracts where they live or introduce a narrow metadata registry without installing inactive provider dependencies.

## Screenshots

Before-state screenshots are in:

- `docs/validation/phase7c-before/`

Captured with Google Chrome headless at `1440x900` against the active public release:

- `home-1440x900.png`
- `discover-1440x900.png`
- `composer-1440x900.png`
- `activity-1440x900.png`
- `profile-1440x900.png`
- `board-1440x900.png`
- `product-hub-1440x900.png`
- `vault-notes-1440x900.png`
- `settings-1440x900.png`
- `appearance-1440x900.png`
- `login-1440x900.png`
- `registration-1440x900.png`

## Known Failures And Placeholders

- The public web release is from `phase7b-greenfield-module-host`, not the new Phase 7C branch.
- `/v1/meta` still reports `modules:false` while Greenfield module registry/install/declarative capability flags are true.
- `mediaUpload:false`; media publishing is not production-ready.
- AT Protocol is disabled and must remain optional.
- DIMON is disabled and must remain inactive.
- The current native tab list includes `Board` as a permanent tab, conflicting with the Phase 7C root destination contract.
- The current native tab list hides `Create`, conflicting with the Phase 7C central Create action.
- Product Hub naming competes with Marketplace/Modules in current route and drawer labels.
- Some product routes are preview/lab surfaces and should not appear in normal Founder Alpha navigation.
- The Phase 6S audit previously classified comments/replies/quotes/multi-reactions/saves/follow decode/activity-search integration as incomplete or broken; these must be re-audited against the current Phase 7B/7C code before implementation claims.
- Native iOS, physical iPhone, and TestFlight acceptance are not proven on the VPS baseline.
