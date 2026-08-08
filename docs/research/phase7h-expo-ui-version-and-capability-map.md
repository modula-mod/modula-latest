# Phase 7H Expo UI Version And Capability Map

Date: 2026-08-08
Branch: `phase7h-production-social-hardening`
Base: `origin/phase7g-mainline-product-audit` at `89c842b0d81fb7ee25d6d08537250f72eac5e1af`
Skill used: Expo UI guidance for installed SDK family.

## Repository Gate

Observed commands:

- `git status --short` on `/home/andrei/modula-latest`: clean before branch creation.
- `git fetch --all --tags --prune`: completed with no output.
- `git switch main`: local `main` exists but diverges from `origin/main`.
- `git pull --ff-only`: failed with `fatal: Not possible to fast-forward, aborting.`
- `git rev-parse HEAD` on local `main`: `98d3474ea3d61d347377b8608307f0a7b725771f`
- `git rev-parse origin/main`: `f7a1902d856563ee2fbde302b5ecfdc87d645897`
- `git rev-parse origin/phase7g-mainline-product-audit`: `89c842b0d81fb7ee25d6d08537250f72eac5e1af`

Phase 7G was not contained in local `main` or `origin/main`; it is contained in `phase7g-mainline-product-audit` and `origin/phase7g-mainline-product-audit`.

Decision: start Phase 7H from `origin/phase7g-mainline-product-audit`, because that branch contains the Phase 7G repair commit `9c0dcca` and audit checkpoint `89c842b`, while the divergent local-only `main` commit remains untouched.

## Pinned Expo Stack

Observed commands:

- `pnpm exec expo-doctor`
- `pnpm exec expo-doctor --verbose`
- `pnpm exec expo config --type public`
- `pnpm list expo expo-router @expo/ui react-native react-native-reanimated react-native-gesture-handler @shopify/react-native-skia --depth 0`
- `node /root/.agents/skills/expo-ui/scripts/list-components.js /home/andrei/modula-latest --docs`

| Package / tool | Observed | Expo Doctor SDK 57 expectation | Notes |
| --- | --- | --- | --- |
| Expo SDK config | `57.0.0` | n/a | Public config reports SDK 57. |
| `expo` | `57.0.8` | `~57.0.11` | Patch drift; do not upgrade as part of this gate. |
| `expo-router` | `57.0.8` | `~57.0.11` | Patch drift. |
| `@expo/ui` | `57.0.7` | `~57.0.9` | Installed types are source of truth for implementation. |
| `react-native` | `0.86.0` | `0.86.2` | Patch drift. |
| `react-native-reanimated` | `4.5.0` | `4.5.1` | Patch drift. |
| `react-native-gesture-handler` | `2.32.0` | not flagged | Present. |
| `@shopify/react-native-skia` | `2.6.2` | not flagged | Present and compatible with `expo-thinking-orbs` peer range. |
| `react-native-worklets` | `0.10.0` | `0.10.1` | Required by Expo UI native state/worklet behavior; patch drift. |
| `expo-haptics` | `57.0.1` | not flagged | Installed and matches current SDK 57 docs. |
| `expo-image` | `57.0.1` | `~57.0.2` | Patch drift; still available. |
| `expo-video` | `57.0.2` | not flagged | Installed and matches current SDK 57 docs. |

`pnpm exec expo-doctor` result: `15/20 checks passed`, `5 checks failed`.

Failures:

- Duplicate native module dependency: `expo-web-browser@57.0.2` top-level and `expo-web-browser@15.0.11` nested under `@atproto/oauth-client-expo@0.1.8`.
- `expo-router` expects `@expo/metro-runtime@^57.0.7`; installed `@expo/metro-runtime` is `57.0.5`.
- Native folders exist while `app.config.ts` still contains config-plugin/native config fields that are not auto-synced in non-CNG builds.
- React Native Directory marks `@atproto/oauth-client-expo` as untested on New Architecture.
- SDK 57 patch mismatches across 13 packages.

Native acceptance status: blocked until these Doctor findings are either resolved or explicitly classified with build proof.

## Public Expo Config

Key public config values from `pnpm exec expo config --type public`:

| Field | Value |
| --- | --- |
| `name` | `Modula` |
| `slug` | `modula` |
| `scheme` | `modula` |
| `platforms` | `ios`, `android`, `web` |
| `orientation` | `portrait` |
| `userInterfaceStyle` | `automatic` |
| `ios.bundleIdentifier` | `digital.modula.app` |
| `android.package` | `digital.modula.app` |
| `web.bundler` | `metro` |
| `web.output` | `static` |
| `updates.enabled` | `false` |
| `experiments.typedRoutes` | `true` |

Configured plugins include `expo-router`, `expo-dev-client`, `expo-image-picker`, `expo-camera`, `expo-video`, `expo-secure-store`, and `expo-splash-screen`.

## Official SDK 57 Documentation Inputs

Official Expo documentation currently identifies SDK 57 as the latest SDK for these pages:

- Expo UI docs report recommended `@expo/ui` version `~57.0.9` and describe native UI through Jetpack Compose and SwiftUI.
- Expo UI Universal docs state universal components run from one source across Android, iOS, and web, and must be wrapped in `Host` imported from `@expo/ui`.
- Expo Haptics docs report recommended version `~57.0.1` and support Android, iOS, and web vibration/haptic APIs, subject to platform constraints.
- Expo Image docs report recommended version `~57.0.2` and support performant cached images with transitions.
- Expo Video docs report recommended version `~57.0.2` and support Android, iOS, tvOS, and web playback.

Implementation rule for this checkout: code to installed SDK 57 types (`@expo/ui@57.0.7`) and document patch drift; do not silently upgrade to Doctor's recommended patch set during Checkpoint A.

## Installed `@expo/ui@57.0.7` Capability Map

Installed package source of truth:

- `node_modules/@expo/ui/package.json`
- `node_modules/@expo/ui/build/universal/index.d.ts`
- `node_modules/@expo/ui/build/community/*/index.d.ts`
- `node /root/.agents/skills/expo-ui/scripts/list-components.js /home/andrei/modula-latest --docs`

Universal exports from `@expo/ui`:

`BottomSheet`, `Button`, `Checkbox`, `Collapsible`, `Column`, `FieldGroup`, `Host`, `Icon`, `List`, `ListItem`, `Picker`, `RNHostView`, `Row`, `ScrollView`, `Slider`, `Spacer`, `Switch`, `Text`, `TextInput`.

Community drop-in exports from `@expo/ui/community/*`:

| Drop-in | Installed export |
| --- | --- |
| Bottom sheet | `@expo/ui/community/bottom-sheet` |
| Date time picker | `@expo/ui/community/datetime-picker` |
| Masked view | `@expo/ui/community/masked-view` |
| Menu | `@expo/ui/community/menu` |
| Pager view | `@expo/ui/community/pager-view` |
| Picker | `@expo/ui/community/picker` |
| Segmented control | `@expo/ui/community/segmented-control` |
| Slider | `@expo/ui/community/slider` |

Platform-specific exports are present but restricted:

- `@expo/ui/swift-ui`: iOS only; import only inside bounded platform adapters or dev-only iOS lab files.
- `@expo/ui/jetpack-compose`: Android only; no product-screen direct imports.

## Phase 7H Control Decisions

| Control / surface | SDK 57 support in checkout | Phase 7H decision |
| --- | --- | --- |
| Host | Universal | Required root for every Expo UI subtree; use bounded adapters. |
| Buttons | Universal | Use through `ModulaButton`; migrate auth, settings, Product Hub, confirmations. Keep custom product card actions where visual identity matters. |
| Switches | Universal | Use through `ModulaSwitch` / `SystemSwitch`; migrate direct RN `Switch` call sites. |
| Checkboxes | Universal | Use through `ModulaCheckbox`; auth/legal/privacy forms are P0/P1. |
| Sliders | Universal and community drop-in | Add/keep adapter for settings and media controls; avoid in feed cards unless native control is required. |
| Segmented controls | Community drop-in present; universal SDK root does not expose segmented control | Canonicalize on `ModulaSegmentedPicker` backed by `@expo/ui/community/segmented-control` where stable. |
| Text inputs | Universal | Use through `ModulaTextInput`; preserve autofill/keyboard semantics. For secure fields, prefer existing adapter with platform fallback until native secure semantics are proven. |
| Pickers | Universal and community drop-in | Use through `ModulaPicker` adapter to be created in Phase 7H-B. |
| Menus | SwiftUI adapters exist; community menu export exists | Keep menus adapter-only; evaluate community menu for Android/web parity before broad migration. |
| Bottom sheets | Universal and community drop-in | Keep `ModulaSheet` as canonical; no feature-level direct imports. |
| Lists / Field groups | Universal | Use in Settings and compact forms; do not use for feed virtualization or product cards. |
| Progress | SwiftUI adapter exists; universal list shows no `Progress` root export | Use `ModulaProgress`; ensure upload/install progress is real bytes/state, not timers. |
| Native icons | Universal `Icon`; SwiftUI SF Symbol adapters exist | Use through `ModulaIcon` adapter to be created or consolidated; do not scatter platform imports. |

## Explicit Non-Targets

Do not replace these product components with generic native controls:

- `PostCard` / social post presentation
- story ring
- story viewer
- profile header
- feed layout
- media gallery
- reaction animation
- custom module presentation
- reels player

These surfaces remain Modula product UI and should only consume Expo UI through internal controls such as menus, sheets, buttons, and form fields.

## Open Native Health Blockers

1. `expo-doctor` red on duplicate native module and SDK 57 patch drift.
2. Local `main` diverges from `origin/main`; Phase 7H is intentionally based on `origin/phase7g-mainline-product-audit`.
3. Native iOS proof cannot be claimed from this Linux host. The Mac gate remains required after backend/API portions are pushed.
