# Phase 1 Social Shell Architecture

Phase 1 turns the Expo SDK 57 foundation into a local, testable Modula social shell. It intentionally avoids backend state, authentication, AT Protocol, push notifications, OTA updates, dynamic module loading, Reanimated, Worklets, native drawer packages, and gesture-driven infrastructure.

## Runtime Shape

- Root stack: `src/app/_layout.tsx`
- Primary tabs: `src/app/(tabs)/_layout.tsx`
- Global providers: `DemoSocialProvider` and `ShellDrawerProvider`
- Drawer: `src/shell/NavigationDrawer.tsx`
- Drawer state machine: `src/shell/ShellDrawerContext.tsx`
- Composer modal: `src/features/composer/screens/ComposerScreen.tsx`
- Composer tools sheet: `src/components/composer/ComposerToolsDrawer.tsx`
- Local data: `src/demo/*`

The route files remain thin and delegate implementation to `src/features/*` screens.

## Navigation Model

Primary destinations:

- Home
- Discover
- Create
- Activity
- Profile

Create is a central action that opens `/compose`; it is not a persistent content screen.

Secondary destinations live in the drawer:

- Board
- Messages
- Saved
- Communities
- Teams
- Modules
- Marketplace
- Settings

The Reels-style still-media prototype is available from Discover, Home header media control, and `/reels`.

## Safety Rules

The drawer and Composer Tools sheet use React Native `Modal` and built-in `Animated` only. Animations stop on unmount and reduce duration when reduced motion is enabled. Haptics are best-effort through `src/lib/haptics.ts` and never block state changes.

All demo state is in memory. A full reload resets local posts, follows, likes, saves, and reposts.

## Development Client

`expo-dev-client` is installed and configured in `app.config.ts`. EAS development profiles live in `eas.json`. Ordinary TypeScript and styling edits should only require Metro restart after the first development build is installed. Native rebuilds are required for native package, config plugin, capability, app identity, or native configuration changes.

OTA updates remain disabled for Phase 1 with `updates.enabled: false`.
