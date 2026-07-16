# Shell

Phase 1 shell components own the social application chrome:

- `AppHeader` owns the top safe-area edge on feed-style screens.
- `MainTabBar` wraps Expo Router's stable JavaScript tabs without replacing navigation behaviour.
- `ShellDrawerContext` owns the Animated drawer state machine.
- `NavigationDrawer` is implemented with React Native `Modal` and built-in `Animated`.
- `SecondaryScreenHeader` owns the top safe-area edge on secondary routes.
- `ResponsiveContent` constrains feed-like content on tablet and web.

The shell does not use Reanimated, Worklets, native drawer packages, or gesture-handler drawers.
