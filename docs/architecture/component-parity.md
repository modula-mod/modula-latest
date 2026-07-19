# Component Parity — Bluesky roles → Modula

Policy: reimplement component **roles**, not Bluesky files. No ALF / `@bsky.app/*`.

| Bluesky role / area | Modula target | Status |
|---|---|---|
| Typography / Text | `AppText` | Implemented |
| Button / Pressable | `AppButton`, `AppPressable` | Implemented |
| Screen / SafeArea | `AppScreen` | Implemented |
| Divider | `AppDivider` | Implemented |
| Avatar | `AppAvatar` | Implemented |
| Image | `AppImage` (expo-image) | Implemented |
| Flat list | `AppList` | Implemented |
| Search field | `AppSearchField` | Implemented |
| Chip / topic pill | `AppChip` | Implemented |
| Empty state | `AppEmptyState` | Implemented |
| Post row (feed item) | `features/feed/FeedPostRow` | Implemented (mock) |
| Profile header | `features/profile/ProfileHeader` | Implemented |
| Profile section tabs | `features/profile/ProfileTabs` | Implemented |
| Settings row / section | `SystemListRow`, `SystemSection` | Implemented |
| Toggle / Switch | `SystemSwitch` (`@expo/ui`) | Implemented |
| Composer FAB | `shell/ComposerFab` | Implemented |
| Screen header | `shell/ScreenHeader` | Implemented |
| Dialogs / menus | — | Stub via `stubAction` / Alert |
| Image grid / media viewer | — | Deferred |
| Bottom sheet / composer tools drawer | Compose `+` Alert stub | Stub |
| Toast / prompt | `stubAction` | Minimal |
| Moderation labels UI | — | Deferred |
| Rich text / facets | Plain text posts | Deferred |
| Video player | — | Deferred |

## Rules

1. Screens compose primitives — avoid one-off StyleSheets for colours.
2. Features import `@/components/system/*` / `@/platform/ui/*`, never `@expo/ui/swift-ui`.
3. Social presentation uses `SocialProvider` types only.
4. Evaluate new Expo UI candidates in Settings → Developer → Expo UI Lab
   (`src/platform/ui/dev/expo-ui-lab`) before promoting into wrappers.
