# Phase 7M visual gallery index

Do not copy finished app screenshots blindly. Map **one observed idea → one Modula component**.

Full-resolution captures belong under `docs/research/phase7m-gallery/` when 7M-B records them. 7M-A records the index only.

| Gallery item | Source | Study | Modula mapping | Do not copy |
| --- | --- | --- | --- | --- |
| Expo UI universal | https://docs.expo.dev/versions/v57.0.0/sdk/ui/universal/ | Native-backed control structure | Button, TextInput, Switch, Picker, Sheet | SaaS default theming |
| Expo SwiftUI gallery | https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/ | iOS hierarchy / materials | Settings, Auth, Sheet | Every modifier as decoration |
| Expo Button | SwiftUI Button docs for SDK 57 | Sizing, symbol placement | ModulaButton | Glass on every button |
| Expo BottomSheet | SDK 57 BottomSheet docs | Detents, scoped presentation | ModulaSheet | Unverified latest-main APIs |
| Expo List | SDK 57 List docs | Settings hierarchy | Settings rows | Creating all rows up front in huge lists |
| Apple HIG | https://developer.apple.com/design/human-interface-guidelines/ | Platform behaviour | iOS adapter | Pixel-identical iOS clone of Modula social |
| Apple Accessibility | HIG Accessibility | Labels, type, contrast | All components | Optional a11y |
| Apple Materials | HIG Materials | Separation of chrome/content | Surface runtime | Glass wallpaper |
| SF Symbols | https://developer.apple.com/sf-symbols/ | Semantic iOS glyphs | ModulaIcon iOS map | Icon-font fallback |
| Material 3 | https://m3.material.io/ | Android control semantics | Android adapter | Paper as global theme |
| Expo NCL UI screens | Expo repo `apps/native-component-list/src/screens/UI` | Real package integration | UI Lab | Copying demo layout into Home |
| TrueSheet example | https://github.com/lodev09/react-native-true-sheet | Native sheet behaviour | Sheet fallback study | Installing in 7M-A |
| Gorhom | https://github.com/gorhom/react-native-bottom-sheet | Drag/snap | Gesture study | Runtime dep |
| Reanimated examples | Reanimated `apps/common-app` | Interaction | Motion lab | Random springs |
| RNGH release tests | Gesture Handler repo | Pan/swipe | Drawer / reactions | |
| Radix | https://github.com/radix-ui/primitives | Web focus/dialog/menu | Web adapters later | shadcn look |
| Simform Story View | GitHub | Timing/state | Story viewer study | Owning Stories |

When capturing:

```text
reference
source URL
captured date
component
what to study
what NOT to copy
licence/source status
```
