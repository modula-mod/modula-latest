# Phase 7M-B5 — component provenance

No blind dependency installs. Prefer installed Expo 57 / RN 0.86 APIs and existing Modula adapters.

| Candidate | Repo | SHA/tag | File / API | Licence | Maintenance | Expo 57 | RN 0.86 | iOS | Android | Web | A11y | Perf | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Expo UI universal | `expo/expo` packages/expo-ui | SDK 57 / `@expo/ui@57.0.10` installed | Button, Switch, Picker, TextInput, Host, List, BottomSheet | MIT | First-party Expo | yes | yes | yes | yes | yes (Icon **no**) | Native semantics | Host cost on each tree | USE_DIRECTLY via adapters |
| Expo UI SwiftUI Menu/Button glass | same | 57.0.10 | `buttonStyle('glass')`, Menu | MIT | First-party | yes | yes | iOS 26+ glass | n/a | n/a | Native | Menu dismiss caveats | ADAPT in lab + optional chrome |
| Expo UI Compose FAB/Search/Nav | same | 57.0.10 | `@expo/ui/jetpack-compose` | MIT | First-party | yes | yes | n/a | yes | n/a | Compose semantics | Lab first | ADAPT in Compose lab |
| expo-glass-effect | Expo | 57.0.1 installed | GlassView | MIT | First-party | yes | yes | version-gated | no | no | Fallback View | Forbidden over feed text | OPTIONAL chrome only |
| Reanimated | software-mansion | 4.5.1 installed | gestures, springs | MIT | Active | yes | yes | yes | yes | yes | Reduce Motion required | UI thread | USE_DIRECTLY |
| Gesture Handler | software-mansion | 2.32.0 installed | Gesture.Pan / LongPress | MIT | Active | yes | yes | yes | yes | pointer | SR fallback menu | — | USE_DIRECTLY |
| animation-samples toolbar / grid mag | Aashu-Dubey/react-native-animation-samples | MIT repo, do not vendor | Custom Toolbar, Grid Magnification | MIT | Sample app | compatible conceptually | compatible | yes | yes | reimplement | must add SR | — | REIMPLEMENT_BEHAVIOUR |
| Native Bloom blocks | nativebloom.dev | n/a | video catalogue | **not a licence** | catalogue | unknown | unknown | unknown | unknown | unknown | unknown | unknown | INSPIRATION_ONLY |
| FlashList | Shopify | — | — | MIT | Active | not admitted | — | — | — | — | — | — | REJECT this phase |
| TrueSheet / Gorhom | — | — | — | — | — | — | — | — | — | — | — | — | REJECT this phase |
| Moti / Paper / NativeWind | — | — | — | — | — | — | — | — | — | — | — | — | REJECT this phase |
| Skia extra effects | @shopify/react-native-skia 2.6.2 | installed | — | MIT | Active | yes | yes | yes | yes | limited | — | Do not add extras | Existing only; no speculative Skia demos |
| Shared transitions | RN / Reanimated | installed | — | MIT | — | — | — | — | — | limited | Reduce Motion | — | INSPIRATION_ONLY unless a flagship job appears |
| expo-image / expo-video / expo-blur | Expo | installed | media | MIT | First-party | yes | yes | yes | yes | yes | alt text | use existing media stack | USE_DIRECTLY |

---

## Decision for B5 flagships

Ship with **existing** Reanimated, RNGH, Expo UI adapters, expo-image. Reimplement reaction proximity and composer toolbar behaviour. No new UI framework. No Expo SDK upgrade.
