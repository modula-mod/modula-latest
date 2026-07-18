# Shell

Phase 1 shell components own the social application chrome:

- `AppHeader` owns the top safe-area edge on feed-style screens.
- `MainTabBar` wraps Expo Router's stable JavaScript tabs without replacing navigation behaviour.
- `ShellDrawerContext` owns the Reanimated drawer state machine (spring open / timed close).
- `NavigationDrawer` is a `Modal` with pan-to-dismiss, staggered rows, and progressive-blur footer.
- `SecondaryScreenHeader` owns progressive-blur chrome on secondary routes (content may scroll under the fade).
- `ResponsiveContent` constrains feed-like content on tablet and web.

Drawer motion uses admitted `react-native-reanimated` + `react-native-gesture-handler` — not a third-party drawer package.
