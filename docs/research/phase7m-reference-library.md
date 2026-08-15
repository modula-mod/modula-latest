# Phase 7M reference library

Study set, **not a shopping list**. Commit hashes below are from the research pack (15 Aug 2026). Before adapting any file, record the SHA **you actually inspected**.

Prefer installed Expo 57 sources in `node_modules/@expo/ui` over GitHub `main`.

| Reference | Decision | What to study | Licence / snapshot |
| --- | --- | --- | --- |
| Expo / Expo UI | USE_DIRECTLY | `node_modules/@expo/ui` 57.0.10; NCL UI screens in Expo repo | MIT; pack snapshot `037d1aa` on 15 Aug 2026 — **re-pin to installed tag** |
| Expo native-component-list | INSPIRATION_ONLY | `apps/native-component-list/src/screens/UI/` | MIT |
| expo-image / expo-video / expo-haptics / expo-blur / expo-glass-effect | USE_DIRECTLY or ADAPT | Installed SDK 57 packages | MIT |
| Expo Router | USE_DIRECTLY | Installed `expo-router` 57.0.12 | MIT |
| Reanimated | USE_DIRECTLY | Installed 4.5.1; reduced-motion APIs | MIT |
| Gesture Handler | USE_DIRECTLY | Installed 2.32.0 | MIT |
| FlashList | ADAPT later | Not installed. Benchmark before admission | MIT |
| TrueSheet | ADAPT candidate | Not installed. Inspect tag before any install | MIT; pack cites v3.11.11 `23e119c` |
| Gorhom Bottom Sheet | INSPIRATION_ONLY | Gesture/snap architecture; Reanimated 4 caveats | MIT |
| React Native Paper | INSPIRATION_ONLY | Material state handling. Not Modula’s global DS | MIT |
| RN Segmented Control | ADAPT fallback | Already installed `2.5.7` | MIT |
| Radix Primitives | ADAPT web-only later | Dialog / menu / tabs a11y | MIT |
| Floating UI | ADAPT web later | Anchoring | MIT |
| shadcn/ui | INSPIRATION_ONLY | Organisation, not SaaS look | MIT |
| Simform Story View / Reactions | INSPIRATION_ONLY | Timing / geometry. Do not own Stories | MIT |
| Moti | REJECT initially | Extra motion abstraction | MIT |
| SwiftUIX / Introspect | INSPIRATION / REJECT normally | Bridging study only | — |

Existing Modula research to keep using:

- `docs/research/phase7h-expo-ui-version-and-capability-map.md`
- `docs/research/phase7h-expo-ui-migration-matrix.md`
- `docs/research/phase7i-mac-a-expo-ui-inventory.md`
- `docs/research/phase7f-b-expo-ui-component-map.md`

Those maps are older than `@expo/ui` 57.0.10. Re-check the installed module before copying their API names.
