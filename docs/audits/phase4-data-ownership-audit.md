# Phase 4 Data Ownership Audit

Branch: `phase4-data-auth-runtime`  
Starting commit: `2379b22f8121d197cd75d62e365c83785adceb1e`

## Current Runtime Ownership

| Data | Current owner before Phase 4 | Correct future owner | Migration |
|---|---|---|---|
| Feed posts | `DemoSocialContext` | `FeedRepository` + TanStack Query | Phase 4 migrated to `useHomeFeedQuery` and `useProfileFeedQuery` |
| Like state | `DemoSocialContext` | `PostRepository` mutation + query cache | Phase 4 migrated to optimistic mutation hooks |
| Save state | `DemoSocialContext` | `PostRepository` mutation + query cache | Phase 4 migrated to optimistic mutation hooks |
| Repost state | `DemoSocialContext` | `PostRepository` mutation + query cache | Phase 4 migrated to optimistic mutation hooks |
| Follow state | `DemoSocialContext` and `ProfileProvider` | `SocialGraphRepository` + query cache | Phase 4 migrated to `useFollowProfileMutation` |
| Profiles | `ProfileProvider` seeded through `DemoProfileRepository` | `ProfileRepository` + Query | Phase 4 migrated profile records to query hooks |
| Profile edits | `ProfileProvider` mutation | `ProfileRepository.updateProfile` + Query | Phase 4 migrated to `useUpdateProfileMutation` |
| Profile posts | Demo post arrays | `FeedRepository.getProfileFeed` + Query | Phase 4 migrated profile tabs |
| Activity | `src/demo/demoActivity` imports | `ActivityRepository` + paged query | Phase 4 migrated to `useActivityQuery` |
| Discovery | `src/demo` imports | `DiscoverRepository` + Query | Phase 4 migrated to `useDiscoverQuery` |
| Reels | `src/demo/demoReels` imports | `ReelsRepository` + Query | Phase 4 migrated to `useReelsQuery` |
| Saved posts | Preview route | `PostRepository.getSavedPosts` + Query | Phase 4 added `/v1/posts/saved` |
| Session | None | `SessionProvider` + `AuthRepository` + secure storage | Phase 4 added discriminated session runtime |
| Profile tab order | `ProfileProvider` | Profile presentation storage | Retained locally |
| Profile layout | `ProfileProvider` | Profile presentation storage | Retained locally |
| Appearance | `AppearanceProvider` | Appearance storage | Retained locally |

## Root Provider Order

Phase 3 order:

`AppErrorBoundary -> AppearanceProvider -> DemoSocialProvider -> ProfileProvider -> ShellDrawerProvider -> RootNavigator + NavigationDrawer`

Phase 4 target order:

`AppErrorBoundary -> AppearanceProvider -> AppServicesProvider -> QueryRuntimeProvider -> SessionProvider -> ProfilePresentationProvider -> ShellDrawerProvider -> RootNavigation + NetworkStatusBanner`

## Demo Data Boundary

Reusable Phase 1-3 seed records are now consumed only by `src/api/local/seedLocalApiDatabase.ts`. Feature screens and repositories do not import seed arrays directly.

`src/demo/DemoSocialContext.tsx` has been deleted. The remaining `src/demo/*` files are seed-source inputs for the local API simulator and are not application state owners.

## Direct Context Consumers

Context consumers after Phase 4 are limited to provider hooks:

- `src/runtime/useAppServices.ts`
- `src/auth/runtime/useSession.ts`
- `src/auth/runtime/useSessionActions.ts`
- `src/data/network/useNetworkStatus.ts`
- profile presentation hooks under `src/features/profile/runtime`
- appearance hooks under `src/theme/runtime`

Screens consume feature query/mutation hooks instead of server-data contexts.
