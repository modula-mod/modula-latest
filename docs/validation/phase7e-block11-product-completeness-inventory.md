# Phase 7E Block 11 Product Completeness Inventory

Date: 2026-08-01
Environment: VPS/Linux
Inventory scope: visible Expo Router web/runtime surfaces in `/home/andrei/modula-latest`.
Canonical runtime for Block 11 acceptance: `EXPO_PUBLIC_DATA_SOURCE=remote` against the isolated Greenfield API/database.

Status vocabulary:

- `REAL_AND_COMPLETE`: backed by real API/service/persistence and accepted by a verifier or E2E flow.
- `REAL_BUT_INCOMPLETE`: has real backend or UI pieces, but missing required operations, state coverage, or acceptance.
- `LOCAL_ONLY`: works only through local simulator, local storage, or in-memory state.
- `HARDCODED`: visible content/count/action source is a static product-runtime object.
- `PLACEHOLDER`: route or component presents planned product capability without operational backing.
- `BROKEN`: visible flow is known to fail or route incorrectly.
- `NOT_REACHABLE`: implementation exists but is not exposed through current navigation.
- `DEFERRED_AND_HIDDEN`: acceptable only after hidden behind a capability/developer gate.

## Runtime Sources Found

- Remote API transport exists through `src/runtime/createAppServices.ts` and `src/api/transport/HttpApiTransport.ts`.
- Local simulator still exists through `src/api/local/*` and is allowed only when `EXPO_PUBLIC_DATA_SOURCE=local`.
- Product remote runtime must not fall back to local module catalogues, in-memory module records, seeded composer tools, or legacy public activity. Block 11 edits made those fallbacks local-only in:
  - `src/data/repositories/api/ApiModuleRepository.ts`
  - `src/data/repositories/api/ApiActivityRepository.ts`
  - `src/data/repositories/api/ApiToolsRepository.ts`
  - `src/data/repositories/api/ApiExtensionRepository.ts`
- Product-visible seed/demo sources still present and requiring completion or capability hiding:
  - `src/features/social/data/seededSurfaces.ts`
  - `src/features/marketplace/data/catalog.ts`
  - `src/features/profile/data/demoProfiles.ts`
  - `src/features/profile/data/demoProfileModules.ts`
  - `src/features/presence/data/presenceRailSeed.ts`
  - `src/features/reels/data/algorithmSeeds.ts`
  - `src/features/product/data/*`
  - `src/features/composer/screens/ComposerScreen.tsx` demo link preview and local thread draft behavior

## Required Surface Matrix

| Surface | Route | User action | Current data source | Current API | Current persistence | Current status | Required work | Acceptance test |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Authentication registration | `/(auth)/register`, `/(auth)/create-account` | Create account | UI form plus `ApiAuthRepository.register` | `POST /v1/accounts/register` | `greenfield_accounts`, handles, auth identities, password credentials, email verification rows | `REAL_BUT_INCOMPLETE` | Enforce terms/privacy server-side, persist display name, safe duplicate responses, SMTP delivery, no token-in-URL for product acceptance | Register account against isolated API, assert pending account, verification row, SMTP message, no auto-login |
| Email verification | `/(auth)/verify-email` | Enter code/resend | API verification token; dev may expose token | `POST /v1/accounts/verify-email`, `POST /v1/accounts/resend-verification` | `greenfield_email_verifications`, repository/profile bootstrap | `REAL_BUT_INCOMPLETE` | Add real SMTP transport and product-safe code delivery; avoid product runtime auto-filling code | Register, read SMTP sink message, verify, assert active account/profile/repository |
| Login/current session | `/(auth)/sign-in`, app bootstrap | Sign in/bootstrap | `ApiAuthRepository`, access token memory, secure/native storage boundary | `POST /v1/sessions`, `GET /v1/accounts/me`, profile route | `greenfield_sessions`, `greenfield_session_tokens` | `REAL_BUT_INCOMPLETE` | E2E access-expiry refresh proof; web memory-only session acceptance | Login, force expiry, refresh, continue session |
| Refresh/logout/revocation | App bootstrap/settings/account sessions | Refresh, logout, revoke sessions | `GreenfieldSessionService` | `POST /v1/sessions/refresh`, `DELETE /v1/sessions/current`, `DELETE /v1/sessions/:id` | `greenfield_sessions`, `greenfield_session_tokens`, events | `REAL_BUT_INCOMPLETE` | Full E2E plus replay prevention verifier | Login, refresh once, reuse old refresh fails, logout revokes |
| Forgot/reset password | `/(auth)/forgot-password`, `/(auth)/reset-password` | Request/reset password | Frontend repository methods exist; backend recovery service exists | `POST /v1/accounts/forgot-password`, `POST /v1/accounts/reset-password` registered during this checkpoint | `greenfield_recovery_tokens`, password credentials, session revocation | `REAL_BUT_INCOMPLETE` | Add real SMTP delivery/sink for product acceptance; update UI response handling against remote API | Request recovery, receive SMTP sink token, reset password, old sessions revoked |
| Home feed | `/(tabs)/index`, `/` | Switch feed modes, paginate, refresh | `ApiFeedRepository`; local feed simulator when local runtime | `GET /v1/feed/home` | post/profile/reaction/save/repost tables | `REAL_BUT_INCOMPLETE` | Verify Following/For You/Modules ranking and empty/error/offline states; remove local demo fallback from acceptance | Create/follow/repost/module records, assert feed contents and cursors |
| Feed mode selector | `/(tabs)/index` | Select Following/For You/Modules | UI state plus feed query | `GET /v1/feed/home?mode=` | none directly | `REAL_BUT_INCOMPLETE` | Prove each mode maps to real query and no timed state simulation | E2E select each mode, assert API request and database-backed results |
| Composer text post | `/compose`, `/(tabs)/create` | Create post | `ComposerScreen`, `useCreatePostMutation` | `POST /v1/posts` | `posts` and activity/event side effects | `REAL_BUT_INCOMPLETE` | Remove demo link preview, local thread-only disclaimer, inactive preview tools; wire media/polls/link previews | Compose text, assert authoritative post appears in feed |
| Composer tools drawer | `/compose` | Open tool drawer/select tool | `ApiToolsRepository`; hardcoded built-ins now local-only | `/v1/modules/contributions`, `/v1/tools` | module contribution records | `REAL_BUT_INCOMPLETE` | Implement real core composer tool registry; hide unavailable tools | Remote E2E shows only API/module tools and no preview stubs |
| Posts | `/post/[postId]`, feed rows | Read, like, save, repost | `ApiPostRepository` | `GET /v1/posts/:id`, post engagement routes | posts/reactions/saves/reposts | `REAL_BUT_INCOMPLETE` | Edit/delete/restore/share/report/quote/media/poll support | API integration plus UI post detail E2E |
| Post media | feed/composer/post detail | Attach/view media | partial backend file-root media service | media intent route not inventoried as complete | media file root/table records | `REAL_BUT_INCOMPLETE` | Bounded upload intent, checksum, metadata, object storage/MinIO, signed reads | Upload image, assert object record and bytes, post attachment renders |
| Comments | post detail/comment components | Create/list/react/report | backend comments service; frontend query exists | comment routes in `register-routes.ts` | comments/reactions/counts | `REAL_BUT_INCOMPLETE` | Thread UI acceptance, nesting policy, notifications/events | Create comment/reply, assert count/event/notification |
| Reactions | feed/post/comment | Add/change/remove | `ApiPostRepository.likePost`, reaction services | `/v1/posts/:id/like`, comment reaction route | reaction tables/projections | `REAL_BUT_INCOMPLETE` | Central reaction picker/summary, aggregate/current-user reconciliation | Add/change/remove, assert counts from DB |
| Reposts/quotes | feed/post | Repost/quote | repost route exists; quote service exists | repost routes, quote routes | repost/quote tables | `REAL_BUT_INCOMPLETE` | Quote composer and source visibility/deletion policy | Repost/undo/quote E2E |
| Bookmarks/saved | `/saved` | Save/unsave/list | `ApiPostRepository.getSavedPosts` | `/v1/saves` | saves table | `REAL_BUT_INCOMPLETE` | Ownership/privacy E2E; no public count decision | Save/list/unsave across accounts |
| Stories | home presence rail | View story rail | `src/features/presence/data/presenceRailSeed.ts` | none | none | `HARDCODED` | Hide through server capability flag or implement real story records | Capability off hides rail; capability on requires real story CRUD |
| Reels | `/reels`, `/reels/algorithm` | Watch/interact with reels | `ApiReelsRepository`; algorithm seed route | `/v1/reels` | posts/media tables if API returns real reels | `REAL_BUT_INCOMPLETE` | Remove algorithm seed product route or gate developer-only; prove real video records | Create video post, assert reel feed/control API |
| Discover | `/(tabs)/discover`, `/discover/*` | Browse/search | `ApiDiscoverRepository`; Inspire/Live routes use seeds | `/v1/discover`, `/v1/search` | search projection tables, profiles/posts/modules | `REAL_BUT_INCOMPLETE` | Hide seeded trends/live/inspire or back with real projections | Search profile/post/module/note with account isolation |
| Unified search | Discover search/product search | Query/filter/navigate | `ApiDiscoverRepository.search`; product search route has hardcoded catalogue | `/v1/search` | `greenfield_search_documents`, recent/saved search not complete | `REAL_BUT_INCOMPLETE` | Recent/saved search persistence, notes/folders, no fabricated counts | E2E query, filters, clear/save search |
| Activity/notifications | `/(tabs)/activity`, settings notification prefs | Mark read/all read/filter | `ApiActivityRepository`; fallback made local-only | `/v1/notifications`, preferences routes | notification tables/preferences | `REAL_BUT_INCOMPLETE` | Category filters, unread badges from API, focus-mode enforcement | Trigger follow/comment/reaction, assert notification/unread/read |
| Profile owner/public | `/(tabs)/profile`, `/profile/[handle]` | View/edit/follow/block/mute/report | `ApiProfileRepository`; profile modules still demo | `/v1/profiles/:handle`, `/v1/profiles/me` | profile tables | `REAL_BUT_INCOMPLETE` | Replace demo module cards/focus halo with real persisted registry/state; graph actions acceptance | Edit profile, follow/unfollow/block/mute/report |
| Followers/following | `/profile/[handle]/followers`, `/following` | List/follow | social graph repository/hooks | graph routes | follow tables | `REAL_BUT_INCOMPLETE` | Pagination, account isolation, block/mute visibility | Two-account follow E2E |
| Board | `/(tabs)/board` | Navigate cards/reorder | board service plus product cards | board route and module installed data partial | board layout table | `REAL_BUT_INCOMPLETE` | Persist ordering/visibility; show only installed/available module cards | Install Vault Notes, assert Board card source and navigation |
| Product Hub | `/marketplace`, `/modules`, `/product` | Browse/filter/install | `ApiModuleRepository`; local fallback now local-only; separate seeded product catalogue remains | module registry routes | registry/install tables | `REAL_BUT_INCOMPLETE` | Hide unrelated seeded marketplace/product foreshadow surfaces; lifecycle progress from jobs/events | Browse registry, inspect release, install/enable/disable/update/uninstall |
| Module detail | `/marketplace/[moduleId]`, `/module/[moduleId]` | Inspect permissions/health/settings | module repository | registry/module routes | registry/install/settings/health tables | `REAL_BUT_INCOMPLETE` | Permission expansion review, health badge, settings renderer acceptance | Inspect Vault Notes and installed settings |
| Module install/update/uninstall | Product Hub/detail | Install/update/uninstall | real backend services exist | `/v1/modules/:id/install*`, `/enable`, `/disable`, `/update`, uninstall preview | module installation/lifecycle tables | `REAL_BUT_INCOMPLETE` | Progress must reflect lifecycle stages, not UI timers; update detection | Install Vault Notes and assert stages/events/health |
| Vault Notes host | `/module/digital.modula.vault-notes` | Open records/settings/actions | generic module host and backend record service | `/v1/modules/:id/records/*`, settings, health, AI routes | module records/search/AI provenance tables | `REAL_BUT_INCOMPLETE` | Structured editor, autosave, conflict, folders/tags/history/export/search acceptance | Install, create/edit/autosave/search/export note |
| Vault Notes structured editor | module host record view | Edit document blocks | generic field renderer; no full block editor | module record routes | module record revisions | `REAL_BUT_INCOMPLETE` | Paragraph/heading/list/checklist/code/callout/image/file blocks, undo/redo, conflicts | Editor unit/E2E with revision checks |
| Vault Notes version history/export | module host/settings | Inspect/restore/export | backend export service exists partially | module export/record routes | module records/export data | `REAL_BUT_INCOMPLETE` | Bounded snapshots, restore-as-new-revision, JSON/Markdown/text/ZIP | Create revisions, export real file, restore |
| AI Tools | module AI action menu | Execute/preview/apply | Block 9/10 services; deterministic provider in tests; UI calls product action routes | `/v1/modules/:id/ai/actions/*` | AI execution/application/provenance tables | `REAL_BUT_INCOMPLETE` | Product acceptance requires real provider or honest configuration-required state; no deterministic provider in product | Provider absent shows configuration required; real provider smoke if configured |
| Settings home | `/settings` | Navigate rows/search | settings screens; some rows seeded/preview | mixed | mixed | `REAL_BUT_INCOMPLETE` | Remove non-functional rows or capability-gate them | Route audit: every visible row has action/persistence or hidden |
| Appearance | `/settings/appearance` | Change theme/surface/text/reduced motion | appearance repository/runtime | appearance preferences route | appearance preference table/storage | `REAL_BUT_INCOMPLETE` | Web acceptance light/dark/OLED/reduced motion/text scaling | Change setting, reload, assert persisted visual state |
| Accessibility | `/settings/accessibility` | Text/motion/transparency/bold | appearance/accessibility runtime | partial settings | partial | `REAL_BUT_INCOMPLETE` | Persist all controls and verify keyboard/screen-reader labels | Automated a11y on critical routes |
| Privacy | `/settings/privacy`, `/settings/blocked`, `/settings/mute-words` | Change privacy/block/mute | blocked/mute screens currently seeded | incomplete | incomplete | `PLACEHOLDER` | Implement enforced privacy/block/mute policy or hide rows | Cross-account block/mute/search/feed tests |
| Focus Mode | `/product/focus`, product/customize surfaces | Toggle/configure focus | product local preference data | none | local storage | `LOCAL_ONLY` | Persist server-side and enforce notification/feed policy or hide | Toggle focus, notification suppressed by API |
| Glass Privacy | `/product/glass-privacy` | Select privacy level | conceptual product data | none | none | `PLACEHOLDER` | Define enforceable policies or hide/rename unsupported crypto claims | Policy tests for each visible level |
| Account management | `/settings/account/*` | Email/password/sessions/export/logout | account/session/repository export APIs partial | account/session/export routes | account/session/repository tables | `REAL_BUT_INCOMPLETE` | Email change verification, deletion request, recovery routes, export acceptance | Change password, revoke session, export package |
| Notifications settings | `/settings/notifications` | Persist category prefs | API preferences | `/v1/accounts/me/notification-preferences` | notification preference table | `REAL_BUT_INCOMPLETE` | quiet periods/module channel preferences/focus enforcement | Update prefs, trigger muted category, assert suppression |
| Developer component lab | `/dev/components`, `/settings/developer/expo-ui/*` | Inspect component states | dev fixtures/catalog | none | none | `DEFERRED_AND_HIDDEN` | Ensure unavailable in production and mark fixtures development-only | Production env route hidden; dev route covers states |
| Product foreshadow routes | `/product/*`, `/creator/*`, `/teams`, `/messages`, `/lists`, `/collections`, `/communities`, `/drafts` | Browse planned surfaces | seeded product/social data and local storage | mostly none | mostly none | `PLACEHOLDER` | Hide behind capability/developer gate unless backed by real APIs | Production route audit: no placeholder surfaces reachable |

## Immediate Blockers

1. Product-visible seeded/demo route families remain reachable outside a strict developer-only gate.
2. Authentication now has registered recovery routes and isolated API coverage, but still lacks SMTP-backed email/recovery delivery in the current API.
3. Composer media, poll, link preview, and module tool flows are incomplete for real product acceptance.
4. Vault Notes uses generic module records but lacks a complete structured block editor, conflict UI, version history UI, and export acceptance.
5. Product Hub/module lifecycle backend exists, but install progress UI must be tied to lifecycle events instead of static progress language.
6. AI product actions are correctly provider-neutral, but product AI acceptance is blocked unless a real OpenAI/Ollama/hosted provider is configured; deterministic provider remains test-only.
7. Phase 7F Mac/iOS acceptance has not been executed and is not part of this inventory.

## Inventory Acceptance Rule

Block 11 cannot be marked complete while any row classified `HARDCODED`, `PLACEHOLDER`, `LOCAL_ONLY`, or `BROKEN` remains visible in normal remote product runtime. Those rows must either become `REAL_AND_COMPLETE` through implementation and acceptance, or become `DEFERRED_AND_HIDDEN` behind an honest server/developer capability gate.
