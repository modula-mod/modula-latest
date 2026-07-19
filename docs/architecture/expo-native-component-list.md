# Expo Native Component List — Relevance Notes

Study source: [expo/apps/native-component-list](https://github.com/expo/expo/tree/main/apps/native-component-list) (cloned locally under `/tmp/expo-ncl-mono/apps/native-component-list`).

NCL is Expo’s internal gallery of modules and components. Use it to **learn APIs and validation patterns**, not to import its demo app structure.

## Already in Modula (Phase 0) — prefer these first

| Expo module | NCL demos | Modula use |
|---|---|---|
| `expo-image` | `Image/*` | `AppImage` / avatars |
| `expo-symbols` | `SymbolImageScreen` | Tab / chrome icons where useful |
| `expo-glass-effect` | `GlassView` | **Documented stub only** — not default chrome |
| `@expo/ui` | (playground + universal) | System adapters for settings switches |
| `expo-router` | Navigation patterns | File-based tabs + stacks |
| `expo-system-ui` | `SystemUIScreen` | Status / system chrome |
| Gesture Handler / Reanimated / Screens / Safe Area | respective screens | Shell peers |

## Relevant for later phases (do not install yet)

| Area | NCL screens | When |
|---|---|---|
| Haptics | `HapticsScreen` | Phase 2+ polish |
| Blur | `BlurView` | Glass Surface Type engine |
| Image picker / media library | `ImagePicker`, `MediaLibrary` | Composer tools |
| Secure store | `SecureStoreScreen` | Auth / secrets |
| Notifications | `NotificationScreen` | Real notifications |
| Clipboard / sharing | Clipboard, Sharing | Composer / profile |
| Camera / AV | Camera, Audio | Composer tools |
| Localization | `LocalizationScreen` | i18n |
| Skia / GL / Mesh | Skia, GL, MeshGradient | Advanced visuals — high bar for admission |

## Phase 1 decision

**No new Expo modules added** for the shell. Existing `package.json` covers Feed/Board/Explore placeholders, `expo-image` avatars, and `@expo/ui` settings switches.

Dev gallery at `/settings/developer/expo-ui` (alias `/dev/components`) hosts the
Expo UI playground sections (adapted from [expo-ui-playground](https://github.com/betomoedano/expo-ui-playground))
so the team can pick candidates by product context. Live SwiftUI demos live under
`src/platform/ui/dev/expo-ui-lab/`; product screens still consume Modula wrappers only.

## Admission reminder

Any future NCL-inspired dependency requires `docs/architecture/dependency-register.md` update and `pnpm exec expo install <pkg>`.
