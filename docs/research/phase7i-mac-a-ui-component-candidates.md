# Phase 7I-MAC-A — UI Component Candidates

Date: 2026-08-10  
Policy: no speculative installs; prefer Expo SDK 57 / already-admitted packages; adapters in `src/platform/ui`.

| Candidate | Licence | Activity / fit | Decision | Reasoning |
| --- | --- | --- | --- | --- |
| `@expo/ui` (installed `57.0.9`) segmented / Button / Menu / Switch / List / Sheet | MIT (Expo) | First-party SDK 57 | **USE** | Already admitted; keep expanding through adapters |
| `@expo/ui/community/segmented-control` | Expo | Installed path for Home inline modes | **USE** | Current native segmented adapter |
| `@react-native-segmented-control/segmented-control` | MIT | Already in lockfile | **ADAPT** / fallback | Prefer Expo community wrapper; keep as lower-level option only if needed |
| `@callstack/liquid-glass` `0.8.0` | Check package | Tab bar / chrome | **USE** (current) | Do not replace for aesthetics alone |
| `expo-glass-effect` / `expo-blur` | Expo | Partial materials | **ADAPT** | Fallback / progressive blur bands — not full tab bar swap |
| `expo-router` native stack headers | Expo | Header chrome | **USE** | Keep native headers; avoid custom duplicates |
| React Native `ActionSheetIOS` / Expo UI menus | Apple / Expo | Three-dot menus | **USE** via `ModulaContextMenu` / `ModulaMenu` | Prefer over custom floating rectangles |
| Large UI kits (NativeWind, Tamagui, etc.) | — | — | **REJECT** | Dependency policy; one-button problems must not import frameworks |
| Bluesky / `@bsky.app/*` UI | — | Inspiration only | **INSPIRATION_ONLY** | Architecture skill forbids fork/copy |
| Instagram-like Stories libraries | varies | Stories dial | **INSPIRATION_ONLY** / **REIMPLEMENT** | Keep Modula Presence rail; no fixture stories |
| App Store product-card kits | varies | Product Hub | **INSPIRATION_ONLY** | Reimplement density on Modula cards |
| Drawer libraries (reanimated-drawer, etc.) | varies | Shell drawer | **REJECT** for now | Existing `NavigationDrawer` + context works; harden don’t replace |
| Official Expo examples (UI, router, glass) | MIT | Patterns | **INSPIRATION_ONLY** → **ADAPT** | Study then reimplement in adapters |

## Research notes (post-audit)

Prior docs already cover much of this space:

- `docs/research/phase7h-expo-ui-version-and-capability-map.md`
- `docs/research/phase7h-expo-ui-migration-matrix.md`
- `docs/research/phase7h-external-ui-candidates.md`
- `docs/research/phase7g-expo-ui-adoption-audit.md`

Mac phase adds: sticky Home modes must stay **non-Host**; Settings is the best next Host-friendly surface; Stories need empty/error honesty before visual redesign.
