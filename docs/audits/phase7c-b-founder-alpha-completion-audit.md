# Phase 7C-B Founder Alpha Completion Audit

Status: BLOCKED
Date: 2026-07-26
Repository: `/home/andrei/modula-latest`
Branch: `phase7c-modula-product-realisation`
Audited commit: `a540f7e7d4266d5a8c37b6e9310cc5990c5dbe59`

Phase 7C-B is a completion and release-candidate phase. This audit records the current end-to-end state and does not mark Founder Alpha complete.

## User Journey Audit

| Area | Current state | Exact paths | Release status |
| --- | --- | --- | --- |
| Authentication | Greenfield account registration, email verification, sign-in, token refresh, sign-out and session restore exist. Invite-only mode is backed by API config. | `src/auth/screens/CreateAccountScreen.tsx`, `src/auth/runtime/SessionProvider.tsx`, `src/data/repositories/api/ApiAuthRepository.ts`, `services/greenfield-api/src/accounts/service.ts`, `services/greenfield-api/src/sessions/service.ts`, `services/greenfield-api/src/app/register-routes.ts` | Needs browser, native and live replay evidence. |
| Onboarding | Three-step onboarding is implemented and routes to register/sign-in. It records local onboarding completion. | `src/features/onboarding/screens/OnboardingScreen.tsx`, `src/features/onboarding/data/onboardingStorage.ts`, `src/app/(auth)/onboarding.tsx` | Needs after screenshots and physical iPhone replay. |
| Home | Feed modes, pagination, refresh, reactions, repost, quote, save, comments and composer entry exist. | `src/features/feed/screens/HomeFeedScreen.tsx`, `src/features/feed/FeedPostRow.tsx`, `src/features/feed/data/*`, `services/greenfield-api/src/app/register-routes.ts`, `services/greenfield-api/src/app/register-phase6s-routes.ts` | Text and single-image media publishing are implemented in code. Live replay evidence is still pending. |
| Composer | Text, reply, quote, audience and media picker UI exist. Composer media now requests upload bytes and sends alt text with post creation. | `src/features/composer/screens/ComposerScreen.tsx`, `src/platform/ui/camera/mediaCapture.ts`, `src/features/feed/data/useCreatePostMutation.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `services/greenfield-api/src/domains/posts/writes.ts`, `services/greenfield-api/src/domains/media/post-media-storage.ts` | Single-image media persistence is implemented in code; live deployment and physical iPhone replay remain pending. |
| Discover | Discover payload loads with loading, retry and empty layout states. Active search now uses `/v1/search` through `useDiscoverSearchQuery` with cursor pagination and server-side case-insensitive fallback. | `src/features/discover/screens/DiscoverScreen.tsx`, `src/features/discover/data/useDiscoverQuery.ts`, `src/data/repositories/api/ApiDiscoverRepository.ts`, `services/greenfield-api/src/domains/search/repository.ts` | Implemented in code; live endpoint proof remains pending. |
| Activity | Notifications load, paginate, mark read and mark all read. | `src/features/activity/screens/ActivityScreen.tsx`, `src/features/activity/data/useActivityQuery.ts`, `src/data/repositories/api/ApiActivityRepository.ts`, `services/greenfield-api/src/domains/notifications/repository.ts` | Needs live replay evidence. |
| Notification preferences | Phase 7C-B adds account-backed get/patch routes and frontend persistence. Worker delivery already honors preferences. | `services/greenfield-api/src/domains/notifications/preferences.ts`, `services/greenfield-api/migrations/013_phase7c_notification_preferences.sql`, `src/features/settings/screens/SettingsExtraScreens.tsx`, `src/api/local/routes/notificationRoutes.ts` | Implemented in this pass; migration and live deployment still pending. |
| Profile | Unified profile, editing, followers/following, modules, tabs and counters are wired through existing repository/query patterns. | `src/features/profile/screens/UnifiedProfileScreen.tsx`, `src/features/profile/screens/EditProfileScreen.tsx`, `src/features/profile/data-query/*`, `services/greenfield-api/src/domains/profiles/*` | Needs native and live acceptance evidence. |
| Board | Board widget order is account-backed and synced through `/v1/board/layout`. | `src/features/board/screens/BoardScreen.tsx`, `src/features/product/runtime/ProductPreferencesProvider.tsx`, `services/greenfield-api/src/domains/board/service.ts`, `services/greenfield-api/migrations/012_phase7c_board_layout.sql` | Implemented; migration on live VPS still pending. |
| Product Hub | Product Hub and module management routes expose install, disable, enable, uninstall, settings, permissions and health surfaces. | `src/features/modules/screens/ProductHubMarketplaceScreen.tsx`, `src/features/modules/screens/ModuleManagementScreen.tsx`, `src/features/modules/components/InstallPreviewSheet.tsx`, `services/greenfield-api/src/modules/routes/index.ts` | Runtime disclosures remain Phase 7D work, not a Phase 7C completion claim. |
| Settings | Account, Profile, Privacy, Security, Notifications, Appearance, Accessibility, Modules, Connections, Data and About routes exist. Developer remains gated. | `src/features/settings/screens/SettingsHomeScreen.tsx`, `src/features/settings/screens/SettingsExtraScreens.tsx`, `src/features/settings/screens/AppearanceScreen.tsx`, `src/features/settings/screens/AccessibilityScreen.tsx` | Notification persistence implemented in this pass. Other preview/future rows remain classified below. |

## Placeholder Classification

| Path | Classification | Decision |
| --- | --- | --- |
| `src/features/settings/screens/SettingsExtraScreens.tsx` | Partially implemented | Notification preference placeholders were replaced with account-backed persistence. Privacy mute/block/report preview labels remain intentional until those full settings editors become scope. |
| `src/features/composer/screens/ComposerScreen.tsx` | Partially implemented | Text, reply, quote and single-image publishing are implemented. Thread extra posts and content-warning enforcement remain outside the current release claim. |
| `services/greenfield-api/src/domains/posts/writes.ts` | Implemented for Founder Alpha scope | Text and single-image media create are implemented. The upload boundary validates bytes and persists `post_media`; AT Protocol media publishing remains blocked. |
| `packages/api-contracts/src/metadata.ts` | Implemented for active Greenfield preview | `PHASE6_PREVIEW_CAPABILITIES.mediaUpload` is true for Modula media upload. Phase 5 preview constants remain historical and disabled. |
| `src/data/repositories/api/ApiToolsRepository.ts` | Intentionally keep out of core claim | Some tool entries are explicit reviewed/local stubs and do not send external side effects. They must stay outside release-critical Founder Alpha claims. |
| `src/lib/stubAction.ts` | Intentionally keep out of core claim | Used for later-phase product surfaces only. Core Founder Alpha actions should not rely on it. |
| `src/components/composer/ComposerToolsDrawer.tsx` | Implemented as unavailable-preview gate | Preview tools are visible but no longer execute local stubs from the core composer; unavailable reviewed-module capabilities are blocked with a safe action message. |
| `src/shell/NavigationDrawer.tsx` | Removed from normal navigation | The visible account-switch placeholder was removed from the drawer. |
| `src/features/social/screens/SocialSurfaceScreens.tsx` | Implemented | The QR placeholder was replaced with a deterministic current-profile copy-link action. |
| `src/features/translate/previewTranslate.ts` | Removed from core actions | The fake translate preview action was removed from feed and reels action catalogues. |
| `src/features/product/screens/*` | Intentionally keep gated/secondary | Preview/lab routes remain future product map surfaces and must not be represented as live Founder Alpha features. |
| `ops/atproto/pds/backup.sh` and `ops/atproto/pds/restore-test.sh` | Intentionally keep | AT/PDS pilot is optional and disabled for Founder Alpha. These scripts are outside the active Greenfield release path. |

## API Parity

| Screen or surface | Required API | Current state |
| --- | --- | --- |
| Authentication | `/v1/accounts/register`, `/v1/accounts/verify-email`, `/v1/accounts/recovery/request`, `/v1/sessions`, `/v1/sessions/refresh`, `/v1/sessions/current` | Present. |
| Feed | `/v1/feed/home`, `/v1/posts`, `/v1/posts/:postId`, post engagement routes | Present for text/social flows. |
| Media composer | Post creation with bounded image upload bytes plus post media persistence and `/v1/media/:mediaFile` serving | Present for one image attachment. Requires live storage-root configuration and replay evidence. |
| Discover search | `/v1/search` with tolerance and cursor pagination | Present in shared contract, backend route/repository, local API route, API repository and Discover screen hook. |
| Activity | `/v1/notifications`, mark read, mark all read | Present. |
| Notification settings | `/v1/accounts/me/notification-preferences` | Added in Phase 7C-B. |
| Profile | `/v1/profiles/:handle`, `/v1/profiles/me`, follow routes | Present. |
| Board | `/v1/board/layout` | Present. |
| Modules | Module registry/install/manage routes under `services/greenfield-api/src/modules/routes/index.ts` | Present for Phase 7B/7C module-host scope. |

## Release Blockers

- Native physical iPhone acceptance is not recorded.
- TestFlight candidate evidence is not recorded.
- Live deployment of migrations `011`, `012` and `013`, plus media storage-root configuration, is not recorded.
- After screenshots for Phase 7C-B are not recorded.
- Final VPS backup and deployment image digest evidence is not recorded.
- Prior-phase release gates still need final handling:
  - `scripts/verify-phase4-5-native-ui.mjs` is stale against later Phase 5/6/7 files and currently fails on old tab, Reanimated and "no Phase 5 files" assumptions.
  - `scripts/verify-phase6-atproto-frontend.mjs` currently fails on missing Atmosphere/Profile AT presentation strings.
  - `scripts/verify-phase6-frontend-boundary.mjs` currently fails because later Phase 7 frontend/native work intentionally changed the protected Phase 6 boundary.
  - `scripts/verify-phase7a-frontend-boundary.mjs` currently fails because Phase 7B/7C product work changed protected frontend paths.
  - `scripts/verify-phase7a-module-platform.mjs` currently fails only on clean working tree.
  - `scripts/verify-phase7b-branch-consolidation.mjs` currently fails because `phase7c-modula-product-realisation` is the active remote/local product branch.

## Verification Commands

Run the automated gates from the repository root:

```bash
node scripts/verify-phase7c-product-complete.mjs
node scripts/verify-phase7c-api-parity.mjs
node scripts/verify-phase7c-placeholder-free.mjs
node scripts/verify-phase7c-release-candidate.mjs
node scripts/verify-phase7c-founder-alpha.mjs
```

Expected current result: product completeness, API parity and placeholder-free verifiers pass. Release-candidate verification fails until live, native, TestFlight and deployment evidence are captured.
