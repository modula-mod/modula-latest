# Phase 4 Data And Authentication Runtime

Starting commit: `2379b22f8121d197cd75d62e365c83785adceb1e`  
Branch: `phase4-data-auth-runtime`  
Framework: Expo SDK 57  
Active data source: local in-process API simulator

## Installed Dependencies

- `@tanstack/react-query@^5.101.2`
- `expo-secure-store@~57.0.1`
- `expo-network@~57.0.1`

## Runtime Shape

Screens call feature hooks. Feature hooks call repositories. Repositories call `ApiClient`. `ApiClient` uses either `LocalApiTransport` or `HttpApiTransport` through the same `ApiTransport` contract.

Authentication follows the same dependency direction:

Routes and controls call session actions and capability hooks. Session runtime calls `AuthRepository`. `AuthRepository` calls the API client. Refresh-token storage is isolated behind `SessionStorage`.

## Provider Order

`AppErrorBoundary -> AppearanceProvider -> AppServicesProvider -> QueryRuntimeProvider -> SessionProvider -> ProfilePresentationProvider -> ShellDrawerProvider -> RootNavigation + NavigationDrawer + NetworkStatusBanner`

## Server State

TanStack Query owns server-shaped state: sessions, accounts, profiles, posts, feeds, post statistics, follows, saved posts, activity, discovery, reels and public module previews.

Profile presentation and appearance remain device-local preferences.

## Migration Status

`DemoSocialContext` is removed. Profile record ownership moved out of the profile presentation provider. Existing seed data is routed through the local API simulator only.

## Native Status

`expo-secure-store` and `expo-network` require a rebuilt development client. Physical-device SecureStore, offline and screenshot acceptance are documented in `docs/validation/phase4-device-results.md` and remain unclaimed until run.
