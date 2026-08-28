# Shell UI V1 — Route audit

**Mission:** Shell UI V1 native product experience reconstruction  
**Source:** `origin/main` `a0d4d7966f4a3ae8f12736d1bb8dff169a3d0227`  
**Worktree:** `/Users/msjoy/Developer/modula-worktrees/shell-ui-v1-reconstruction`  
**Branch:** `cursor/shell-ui-v1-reconstruction`  
**Inventory date:** 2026-08-28  

This audit is of the **latest remote main**, not a previous phase branch. Installed Expo SDK 57.0.16 / React Native 0.86.2 / Expo Router 57.0.16 / `@expo/ui` 57.0.13 / Reanimated 4.5.1 / Gesture Handler 2.32.0.

Routes live under `src/app/` (186 files). Feature logic lives under `src/features/`. Platform adapters live under `src/platform/ui/`.

---

## Installed UI architecture (authoritative)

| Layer | Location | Notes |
| --- | --- | --- |
| Theme | `src/theme/` | Colour mode, family, accent, Surface Type → `ThemeTokens` |
| Platform adapters | `src/platform/ui/` | Buttons, sheets, menus, pickers, icons, tabs. Product screens must not import `@expo/ui/swift-ui` |
| Primitives | `src/components/primitives/` | `AppText`, `AppScreen`, `EmptyState`, `Avatar` |
| System | `src/components/system/` | Error boundaries, settings-native rows |
| Data states | `src/components/data/` | Loading / error / offline / pagination |
| Icons | `src/platform/ui/icons/modula-icon-registry.ts` | iOS SF Symbols / Android+web SVG. Legacy `AppIcon` (Ionicons) still used in some screens |
| UI Lab | `src/platform/ui/dev/expo-ui-lab/` | Developer evaluation only |

**Do not create** a second design system. This mission enhances the layers above.

---

## Shell chrome

| Element | Current owner | Native deps | UX / visual / functional problems | Planned |
| --- | --- | --- | --- | --- |
| Root stack | `src/app/_layout.tsx` | Expo Router Stack | Headers hidden globally; compose/share/report are modals | Keep. Consistent secondary chrome |
| Tab bar | `src/platform/ui/navigation/platform-tabs.native.tsx` | Expo Router `NativeTabs` (iOS Liquid Glass) | Create tab hidden (redirects to `/compose`). Profile disables automatic insets | Preserve native tabs; fix Profile bottom inset |
| Web rail | `platform-tabs.web.tsx` | Custom | Must not be a stretched iPhone layout | Responsive columns / rail |
| Home header | `home-stack-header.tsx` | Native header + compose/messages | Functional | Tighten; keep compose entry |
| Drawer | `src/shell/NavigationDrawer.tsx` | Reanimated + GH | Present; account panel exists but is **not mounted** | Keep drawer; do not fake a second account panel |
| Secondary header | `SecondaryScreenHeader` | Back + title | Consistent | Keep |
| Sheets / menus | `src/platform/ui/sheets`, `menus` | `@expo/ui` adapters | Install failure still uses `Alert.alert` in some paths | Prefer `ModulaSheet` where a sheet already exists |

---

## Core consumer routes

### Home — `/` · `(tabs)/index/index.tsx`

| | |
| --- | --- |
| **Component** | `HomeFeedScreen` |
| **Data** | `useHomeFeedQuery` → social feed repository |
| **Native** | NativeTabs, pull-action tray, Reanimated scroll chrome |
| **Shared** | `SocialPost`, `PresenceStoriesRail`, `FeedPostSkeleton`, `EmptyState` |
| **UX** | Feed modes, composer entry, pull-to-refresh, pagination exist |
| **Visual** | OLED canvas currently `surfaceMuted` (grey) not true black; overlay action rail on posts |
| **Functional** | Real feed query. Empty state has a Create action |
| **Planned** | Content-first canvas; keep real data; larger counters; OLED canvas |

### Profile — `/profile` and `/profile/[handle]`

| | |
| --- | --- |
| **Component** | `UnifiedProfileScreen` → `ProfileShell` |
| **Data** | `useOwnerProfileQuery` / `useProfileQuery` |
| **Native** | Cover chrome, metric picker gestures, sticky tabs |
| **Shared** | `ProfileHero`, `ProfileMetricPicker`, `ProfileTabBar`, `ProfileTabContent` |
| **UX** | Full-bleed cover, avatar overlap, metrics, Overview/Modules/Links/About tabs |
| **Visual** | Metric labels use `micro` (11pt); About tab had hardcoded “Interests” copy |
| **Functional** | Tabs via `?tab=`; follow metrics activate destinations |
| **Planned** | Keep architecture; readable metrics; truthful About; tab-bar clearance |

### Search / Explore — `/discover`

| | |
| --- | --- |
| **Component** | `DiscoverScreen` |
| **Data** | `useDiscoverQuery`, `useDiscoverSearchQuery` |
| **Native** | Segmented picker, search field |
| **Shared** | `EmptyState`, `QueryErrorState`, `PageIntro` |
| **UX** | Categories: For You / People / Communities / Marketplace / Media |
| **Visual** | “Marketplace” truncated on narrow pickers (scrollable already, min width tight) |
| **Functional** | Search uses current APIs only — do not invent domains |
| **Planned** | Wider scroll segments; keep real empty/loading/error |

### Activity — `/activity`

| | |
| --- | --- |
| **Component** | `ActivityScreen` |
| **Data** | `useActivityQuery` |
| **Native** | Filter sheet (`ModulaSheet`), context menus |
| **Shared** | `ActivityDigestStrip`, skeletons |
| **UX** | Grouped Today / This week / Earlier; filters for replies, mentions, reactions, follows, extensions, system |
| **Visual** | Card rows; some “preview” menu language |
| **Functional** | Mute/copy/remove menu items were decorative (no backing). Module-update row hardcoded Vault Notes |
| **Planned** | Truthful event types; only backed actions; generic module destination |

### Notifications

| | |
| --- | --- |
| **Route** | `/settings/notifications` (preferences). **No separate notifications tab.** |
| **Component** | `NotificationsSettingsScreen` |
| **Data** | Notification preference repository |
| **Duplication** | Activity **is** the event stream. Settings Notifications is preference toggles. |
| **Planned** | Document, do not invent a fake second feed. Keep both routes with distinct jobs |

### Composer — `/compose` (modal)

| | |
| --- | --- |
| **Component** | `ComposerScreen` + `ComposerToolsDrawer` |
| **Data** | Composer mutations; `toolsRepository.listComposerTools()` |
| **Native** | Modal presentation, `ModulaSheet` tools |
| **Shared** | Platform inputs, media picker |
| **UX** | `+` in home header is the canonical entry. Tools sheet loads current contribution model |
| **Visual** | Tools drawer still uses `AppIcon` |
| **Functional** | Photo/camera/link/poll wired; GIF and some tools honestly Coming Soon |
| **Planned** | Present tools as an extensible system without changing the registry contract |

### Post detail — `/post/[postId]`

| | |
| --- | --- |
| **Component** | `PostDetailScreen` |
| **Data** | Post query |
| **Native** | Secondary stack |
| **Shared** | `SocialPost` |
| **UX / visual** | Extra “Post” chrome vs in-feed presentation; overlay rail |
| **Functional** | Like/comment/send/save preserved where implemented |
| **Planned** | One post language; do not fabricate types without models |

### Settings — `/settings` and nested tree

| | |
| --- | --- |
| **Component** | `SettingsHomeScreen` + per-route screens |
| **Data** | Appearance runtime, session, modules, connections |
| **Native** | Grouped rows, switches, menus, search |
| **Shared** | `SettingsRows`, `SettingsScreen` |
| **UX** | Real destinations for Account, Appearance, Privacy, Accessibility, Modules, Notifications, Security, Developer |
| **Visual** | Ad-hoc search field; version/env on home; Product Lab links only under Development (gated) |
| **Functional** | Appearance and Accessibility bind to `useAppearance` / actions |
| **Planned** | Native grouped hierarchy; `ModulaSearchField`; no engineering metadata on the consumer home |

### Product Hub — `/product` and `/marketplace`

| | |
| --- | --- |
| **Component** | `ProductHubMarketplaceScreen` (both routes) |
| **Data** | `useModuleCatalogueQuery` → `moduleRepository.listCatalogue` |
| **Native** | Morphing search chrome, editorial hero, shelves |
| **Shared** | Presentation components under `src/features/modules/components/presentation/` |
| **UX** | Featured, New for Modula, Made by Modula, Installed/Updates segments |
| **Visual** | Loading was a caption; empty and failure were easy to confuse |
| **Functional** | Real catalogue. Flash-to-empty risk on query-key change (signed-in vs public) |
| **Planned** | Presentation adapter for loading / empty / partial / failure; `keepPreviousData`; no registry redesign |

### Module Detail — `/marketplace/[moduleId]`

| | |
| --- | --- |
| **Component** | `ModuleDetailScreen` |
| **Data** | `useModuleDetailQuery` |
| **Native** | Cover, sticky header, segmented tabs, install sheet |
| **Shared** | `product-detail/*` |
| **UX** | Cover, identity, Install/Open, metadata rail, tabs |
| **Visual** | Metadata/capability labels hardcoded to 8.5–10.5pt |
| **Functional** | No Save/Notify/Subscribe. Unknown values are `—`. Screenshots have an honest empty state |
| **Planned** | Readable rail type; keep truthful empty preview; no fabricated artwork |

### Module Host — `/module/[moduleId]`

| | |
| --- | --- |
| **Component** | `ModuleHostScreen` |
| **Data** | Host composition / views |
| **Native** | Host chrome, loading, permission gate |
| **Planned** | Improve chrome / loading / unavailable / permission presentation only. Do not change execution contract |

### Auth shell — `(auth)/*`

| Route | Component | Notes |
| --- | --- | --- |
| `/welcome` | `WelcomeScreen` | Marketing landing |
| `/sign-in` | `SignInScreen` | Live auth |
| `/create-account`, `/register` | `CreateAccountScreen` | Same screen, two URLs |
| `/forgot-password`, `/reset-password`, `/recover`, `/verify-email` | matching screens | Live |
| **Planned** | Presentation only. No session/token/passkey/OTP contract changes |

### Onboarding — `/onboarding`

| | |
| --- | --- |
| **Component** | `OnboardingScreen` |
| **Data** | Local 3-step pre-account tour |
| **Truth** | Not post-registration setup. `CreateAccountScreen` does not route here after `register()` |
| **Planned** | Improve presentation; do not invent unavailable product promises |

---

## Other reachable shell routes (classified)

| Route | Component | Class | Planned this mission |
| --- | --- | --- | --- |
| `/board` | `BoardScreen` | Preview / widget home | Chrome consistency |
| `/messages` | inbox/thread | Preview (seeded, honest banners) | Do not fake delivery |
| `/saved` | `SavedPostsScreen` | Live/preview | Shared empty/error |
| `/modules` | `ModulesLibraryScreen` | Live/preview | Shared catalogue states |
| `/settings/modules` | installed management | Live | Consumer presentation, diagnostics stay secondary |
| `/product/*` studios | many preview/catalogue stubs | Honest placeholders | Visual consistency only |
| `/reels`, `/stories/*` | preview | Keep | |
| `/oauth/atproto` | callback | Live | No auth redesign |
| `+not-found` | `NotFoundScreen` | Utility | Keep |

---

## Shared component map

| Concern | Canonical | Notes |
| --- | --- | --- |
| Text | `AppText` + typography roles | Dynamic Type via `allowFontScaling` + scaled lineHeight |
| Buttons | `ModulaButton` / `ModulaIconButton` | Migrate leftover `AppButton` on touched screens |
| Icons | `ModulaIcon` | Do not add an icon font |
| Sheets | `ModulaSheet` | |
| Search | `ModulaSearchField` | Use in Settings / Discover |
| Loading | `InitialLoadingState`, skeletons | Unify caption-only loaders |
| Empty | `EmptyState` / `PageIntro` | What / why / action |
| Error | `QueryErrorState` | Classify offline / permission / not found / unexpected; no stack traces |
| Lists | `FlatList` / query pages | Do not convert feeds to `ScrollView + map` |

---

## Out of scope (parallel backend mission)

Greenfield schema, registry protocol, MPS contracts, module release format, production migrations, Expo SDK upgrade, new general UI libraries.
