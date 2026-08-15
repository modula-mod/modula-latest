# Phase 7M native patterns

Apple HIG and Material 3 describe **roles**, not Modula chrome.

| Pattern | Platform meaning | Modula mapping |
| --- | --- | --- |
| Segmented control | Mutually exclusive linear segments | `ModulaSegmentedPicker` / 7M segmented contract |
| Text field | Focused text entry with label/error | `ModulaTextInput` family |
| Sheet | Scoped task related to current context | `ModulaSheet` |
| Menu / context menu | Actions without leaving context | `ModulaMenu` / context menu adapters |
| Navigation bar / tabs | App-level destinations | Expo Router + `PlatformTabs` |
| Materials | Separate controls from content | Surface runtime; glass = chrome |
| SF Symbols / Material Symbols | Semantic glyphs | Future ModulaIcon adapters |
| Dynamic Type / scaled text | System type size | Existing `TextScale` + UI Lab large-text cases |
| Reduce Motion | System motion preference | Reanimated + constitution |

## Density

Study Apple and mature social clients for **hierarchy and spacing**, then reimplement on Modula tokens. Do not copy Bluesky ALF, `@bsky.app/*`, or screenshot pixels.

## Web

Native iOS/Android controls are not a web free pass. Web adapters need:

- visible focus
- keyboard operation
- dialog focus trap
- no nested interactive HTML (`button` in `button` caused 7L-B `#418`)

## Host boundary

SwiftUI/Compose components require Expo UI `Host`. Putting `Host` in every feed row is a performance defect. Prefer universal components or RN views for list cells unless measurement says otherwise.
