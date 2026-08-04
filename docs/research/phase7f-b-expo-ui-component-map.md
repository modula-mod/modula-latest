# Phase 7F-B — Expo UI Component Map

**Date:** 2026-08-05  
**Pinned package:** `@expo/ui@57.0.7` (declared `~57.0.7`; Expo Doctor wants `~57.0.9` — **no upgrade** this phase)  
**SDK:** Expo 57.0.8 / Router 57.0.8 / RN 0.86.0  
**Adapter home:** extend existing `src/platform/ui/*` (do **not** invent a parallel `src/components/expo-ui/` tree)

## Research inputs

1. Installed package exports (`node_modules/@expo/ui/package.json` `exports`)
2. Universal barrel `build/universal/index.d.ts`
3. Community `build/community/segmented-control/`
4. SwiftUI barrel contents under `build/swift-ui/`
5. Official SDK 57 Universal docs
6. Current Modula adapters under `src/platform/ui/`
7. Phase 7F-A screenshots under `docs/validation/evidence/phase7f-a-ios-simulator/`
8. Simulator behaviour notes from Phase 7F-A smoke (`phase7f-a-mac-ios-simulator-smoke.md`)

## Architecture decision

| Decision | Choice |
| --- | --- |
| Adapter location | Keep / extend `src/platform/ui/` |
| Product import rule | Features import Modula adapters only |
| Prefer | `@expo/ui` universal + `@expo/ui/community/segmented-control` |
| Platform-specific | Only inside adapters when universal cannot meet the need |
| Host policy | One Host per native control subtree; avoid Host-per-label and feed-wide Host |
| Navigation | Preserve validated shell tabs; do **not** migrate to Native Tabs alpha |

---

## Component map

| Current component | Current path | Current problem | Target Expo UI | Pinned availability | iOS | Android | Web | Required adapter | Fallback | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ModulaButton` | `src/platform/ui/buttons/modula-button.native.tsx` | Already universal Button+Host; many screens still use `AppButton` | Universal `Button` + `Host` | Yes | SwiftUI-backed | Compose-backed | JS | Keep / widen role mapping | `AppPressable` (`.tsx`) | Adopt more call sites |
| `AppButton` | `src/components/primitives/AppButton.tsx` | RN pressable; no native chrome | Via `ModulaButton` | Indirect | — | — | — | Prefer `ModulaButton` for listed CTAs | Keep `AppButton` for dense RN layouts | Migrate auth / Product Hub / confirm |
| Icon chrome buttons | `modula-icon-button.native.tsx` | Uses `@expo/ui/swift-ui` Button+Host | Prefer universal Button when possible | Universal Button yes; SF Symbol via SwiftUI | SwiftUI | Compose limited | RN | Keep SwiftUI adapter for SF Symbol labels | RN `Pressable` | Keep for chrome |
| `SystemSwitch` | `src/components/system/SystemSwitch.tsx` | RN `Switch` only | Universal `Switch` + `Host` | Yes | Native | Native | JS | New `modula-switch.native.tsx` + update `SystemSwitch` | RN Switch | Settings / Focus / modules |
| Checkbox (scattered) | ad-hoc RN / pressables | No shared native checkbox | Universal `Checkbox` | Yes | Native | Native | JS | New `modula-checkbox` | RN Pressable | Terms / privacy ack |
| Slider | limited / custom | Not Expo UI | Universal `Slider` | Yes | Native | Native | JS | New `modula-slider` if needed | RN Slider | Optional this phase |
| Auth / search / composer `TextInput` | RN `TextInput` inline | No Expo UI adapter; autofill risk if naively wrapped | Universal `TextInput` | Yes | Native-backed | Native-backed | RN-web | New `modula-text-input` | RN TextInput | Auth, search, composer, profile edit |
| Password fields | RN `secureTextEntry` | No SecureField adapter | Universal secure TextEntry **or** SwiftUI `SecureField` in adapter | Universal secure yes; SecureField SwiftUI-only | Prefer SecureField on iOS | Universal secure | RN | `modula-secure-input` | RN secure TextInput | Login / register / reset |
| `ModulaSegmentedPicker` | `…/modula-segmented-picker.native.tsx` | Home uses `appearance="plain"` + `scrollable` → **custom RN pills** (7F-A home screenshot) | Community `SegmentedControl` primary; SwiftUI `Picker` segmented as secondary | Community export present | SwiftUI segmented Picker | Compose segmented buttons | Vendored RN SC | Retarget adapter to community package; default Home to native | Shared track/plain for sticky/glass overlays | **Mandatory** |
| Sticky feed modes | `HomeStickyFeedModes.tsx` | Forces `appearance="track"` (Host breaks in sticky overlays historically) | Community SC if Host stable; else shared track | Same | Test Host in sticky | Test | Shared | Keep overlay fallback explicit | Shared track | Accept fallback if Host clips |
| Settings lists | `SystemListRow` / `SystemSection` + RN | Rounded debug-ish cards; not Expo UI List | Universal `List` / `ListItem` / `FieldGroup` | Yes | Native list | Compose list | JS | New list/form adapters; migrate Settings | Existing System* | Settings native feel |
| Forms / sections | SwiftUI Form/Section only in lab / disclosure | Product settings not using Form | SwiftUI `Form`/`Section` via adapter **or** universal FieldGroup+List | Form/Section SwiftUI-only; FieldGroup universal | Form native | FieldGroup/List | List JS | Prefer universal List/FieldGroup for cross-platform Settings | SystemSection | Settings |
| Bottom sheets | `modula-sheet.native.tsx` | Already `@expo/ui` BottomSheet + modifiers; multiple sheet systems still coexist | Universal / community BottomSheet | Yes | Native | Native | JS | Consolidate call sites on `ModulaSheet` | RN Modal | Composer tools / actions |
| Menus | `modula-menu.native.tsx` | SwiftUI Menu already | SwiftUI `Menu` (adapter only) | SwiftUI yes | Tap menu | Limited | ActionSheet/RN | Keep | RN ActionSheet | Post overflow |
| Context menus | `modula-context-menu.native.tsx` | Present | SwiftUI `ContextMenu` | SwiftUI yes | Long-press | Limited | RN | Keep | Long-press menu | Post / story |
| Confirmation | `confirmModulaAction.ts` + Alert | Mix of Alert.alert and custom | SwiftUI `ConfirmationDialog` / `Alert` | SwiftUI yes | Native | Alert | `Alert.alert` | New confirmation adapter | RN Alert | Delete / unfollow / disable |
| Progress | custom / timed risk | Must bind real lifecycle | SwiftUI `ProgressView` | SwiftUI yes | Native | Limited | ActivityIndicator | `modula-progress` | RN ActivityIndicator | Uploads / install |
| Disclosure | `modula-disclosure-group.native.tsx` | Present | SwiftUI DisclosureGroup | Yes | Native | — | RN accordion | Keep | Shared accordion | Module detail |
| ColorPicker / DatePicker | lab only | Not product-critical | SwiftUI only | Yes | Native | — | RN pickers | Defer unless Settings needs | RN | Deferred |
| TabView / Native Tabs | shell uses custom liquid glass tabs | Router Native Tabs is alpha | Do **not** replace shell | N/A | — | — | — | None | Keep shell | Rejected for 7F-B |
| Stack.Toolbar | not used | Alpha API | Inspect only | Router 57.0.8 | — | — | — | None | Existing headers | Rejected unless clear win |
| Host | many adapters | Risk of Host-per-widget / matchContents sizing bugs | Universal `Host` | Yes | Required | Required | Passthrough | Shared host helpers | RN View | Audit Host ownership |
| Glass | `expo-glass-effect` + liquid glass chrome | Over-blur risk on cards/lists | Glass APIs + reduce transparency | `expo-glass-effect@57.0.1` | Liquid glass where available | Material | Solid | Existing materials adapters | Solid fill | Tighten usage |

---

## Home segmented control — specific finding

Phase 7F-A `03-authenticated-home.png` shows a custom pill track (`Modules | Following | For You · Quiet`), not `UISegmentedControl`.

Cause in source:

- `HomeFeedScreen.tsx` → `appearance="plain"` **and** `scrollable`
- Sticky clone → `appearance="track"`
- Native path only runs when `appearance === 'segmented' && !scrollable && !embedded`

Phase 7F-B fix:

1. Prefer `@expo/ui/community/segmented-control` inside `ModulaSegmentedPicker` for the default segmented appearance.
2. Home inline control: `appearance="segmented"`, **not** scrollable; labels stay short (`Following | For You | Modules`). Quiet mode must not lengthen the segment label (badge/affordance outside the control).
3. Sticky overlay may keep shared track if Host proves unstable; document as intentional fallback.

---

## Direct-import audit (baseline)

| Area | `@expo/ui` / `swift-ui` / `jetpack-compose` |
| --- | --- |
| `src/features/**` | **None** (good) |
| `src/platform/ui/**` adapters | Allowed |
| `src/platform/ui/dev/expo-ui-lab/**` | Dev-only direct SwiftUI (allowed lab) |
| Product screens | Must stay adapter-only |

---

## Components rejected / deferred

| Component | Why |
| --- | --- |
| Native Tabs | Alpha; static tabs; would risk validated shell |
| Stack.Toolbar | Alpha; no clear product win |
| ColorPicker / DatePicker product-wide | No mandatory Settings need this phase |
| TabView as shell | Conflicts with liquid glass tab architecture |
| Feed-wide Host | Most feed content remains RN; Host only for native controls |
| Replacing Story ring with SwiftUI | Purpose-built Reanimated dial stays RN |

---

## Adoption priority (checkpoints)

1. **SegmentedControl** (Home, Activity, Product Hub, Appearance dark-depth)
2. **Switch / TextInput / SecureInput / Checkbox** (Settings + Auth)
3. **Button migration** on auth and primary CTAs
4. **List / FieldGroup / Form** for Settings
5. **ConfirmationDialog / Progress** for destructive + upload/install
6. Consolidate sheets/menus already present

---

## Version notes

- Expo Doctor reports patch drift (`@expo/ui` 57.0.7 vs expected ~57.0.9). Mission forbids SDK/package upgrades unless unbuildable. Record only.
- Duplicate `expo-web-browser` (AT Proto OAuth) pre-existing; out of scope unless it blocks builds.
