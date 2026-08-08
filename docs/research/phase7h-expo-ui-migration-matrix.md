# Phase 7H Expo UI Migration Matrix

Date: 2026-08-08
Pinned SDK: Expo SDK `57.0.0` config; installed `@expo/ui@57.0.7`
Rule: product screens import Modula adapters, not platform-specific Expo UI packages.

## Current Adapter Baseline

Existing adapter paths:

- `src/platform/ui/buttons/modula-button.native.tsx`
- `src/platform/ui/buttons/modula-button.tsx`
- `src/platform/ui/buttons/modula-icon-button.native.tsx`
- `src/platform/ui/controls/modula-switch.native.tsx`
- `src/platform/ui/controls/modula-checkbox.native.tsx`
- `src/platform/ui/controls/modula-segmented-picker.native.tsx`
- `src/platform/ui/controls/modula-text-input.native.tsx`
- `src/platform/ui/controls/modula-secure-input.tsx`
- `src/platform/ui/controls/modula-list.native.tsx`
- `src/platform/ui/controls/modula-progress.native.tsx`
- `src/platform/ui/menus/modula-menu.native.tsx`
- `src/platform/ui/menus/modula-context-menu.native.tsx`
- `src/platform/ui/menus/chrome-overflow-menu.native.tsx`
- `src/platform/ui/sheets/modula-sheet.native.tsx`

Direct `@expo/ui` product imports are currently restricted to `src/platform/ui/**` and `src/platform/ui/dev/expo-ui-lab/**`, which is the intended boundary. Dev lab direct imports are allowed; feature screens should stay adapter-only.

## Migration Matrix

| Priority | Current component / pattern | Current file(s) | Screens using it | Expo UI equivalent | Supported by pinned SDK? | Accessibility impact | Visual impact | Migration risk | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0 | `AppButton` in auth flows | `src/components/primitives/AppButton.tsx`; auth screens | `SignInScreen`, `CreateAccountScreen`, `ForgotPasswordScreen`, `ResetPasswordScreen`, `VerifyEmailScreen`, `WelcomeScreen`, `ProtectedActionPrompt` | `ModulaButton` -> universal `Button` | Yes | Better native button semantics and Dynamic Type | Native form CTAs; preserve Modula labels and layout | Medium: auth regressions are P0 | Migrate auth CTAs in Checkpoint B after registration contract is stable. |
| P0 | RN `TextInput` in auth primitives | `src/auth/screens/AuthScreenPrimitives.tsx` and auth screens | sign in, create account, verification, password reset | `ModulaTextInput` / `ModulaSecureInput` -> universal `TextInput` or RN fallback | Yes | Preserve autofill, secure entry, keyboard type, return key | Native input behavior; visual wrapper remains Modula | High: auth entry and password managers | Migrate only through adapter, then test real lifecycle. |
| P0 | `ModulaSegmentedPicker` | `src/platform/ui/controls/modula-segmented-picker.*` | Home, Activity, Product Hub, Appearance, Story create | community `SegmentedControl` via adapter | Yes | Native segmented semantics | Removes homemade animated pill for 2-4 choices | Medium: Host/sticky layout clipping | Canonical segmented implementation remains this adapter. |
| P0 | Home feed modes | `src/features/feed/screens/HomeFeedScreen.tsx`; `HomeStickyFeedModes.tsx` | Home Following / For You / Modules | `ModulaSegmentedPicker` | Yes | Announces selected feed filter | Native selected state; quiet mode outside labels | Medium: query reconciliation | Use canonical segmented adapter; selection must drive real feed query. |
| P0 | Activity filters | `src/features/activity/screens/ActivityScreen.tsx` | Activity All / Mentions / Modules | `ModulaSegmentedPicker` | Yes | Native selected filter | Native control inside activity chrome | Low | Keep and verify one canonical adapter. |
| P0 | Product Hub tabs | `src/features/modules/screens/ProductHubMarketplaceScreen.tsx` | Discover / Installed / Updates | `ModulaSegmentedPicker` | Yes | Native selected filter | Native interaction chrome; cards stay custom | Medium | Keep cards custom; migrate only controls. |
| P0 | Settings switches | `src/components/system/SystemSwitch.tsx`; `src/features/settings/components/SettingsRows.tsx`; direct RN switches | Settings, Appearance, Focus Mode, product control screens | `ModulaSwitch` -> universal `Switch` | Yes | Better switch role/state | Native toggles; reduce custom debug look | Medium: many call sites | P0 for Settings; P1 for product/admin screens. |
| P0 | Settings list rows | `src/components/system/SystemListRow.tsx`; `SettingsRows.tsx`; `SystemSection.tsx` | Settings home and nested settings | universal `List`, `ListItem`, `FieldGroup` | Yes | Better row semantics if labels/actions mapped | Native settings feel; less card-like | High: broad settings visual change | Use `ModulaList`/`FieldGroup` progressively, not in one giant rewrite. |
| P0 | Menus / overflow | `src/platform/ui/menus/*`; feature overflow menus | Activity, Board, Reels, Profile, module actions, post/story overflow | SwiftUI `Menu` / `ContextMenu`; community `MenuView` | Partial/cross-platform | Native menu semantics on iOS; fallback required | More OS-native action surfaces | Medium: Android/web parity | Keep adapter-only; no screen imports from SwiftUI/Compose. |
| P0 | Bottom sheets | `src/platform/ui/sheets/modula-sheet.*`; `selection-sheet.tsx` | Activity, Board, composer, profile editors, module AI action sheet, reels author sheet | universal `BottomSheet`; community bottom-sheet drop-in | Yes | Better modal/sheet semantics when labels provided | Native sheet behavior | Medium: snap points and keyboard | Keep `ModulaSheet` as canonical; migrate share/composer sheets through it. |
| P1 | Product Hub search/buttons/menus | `ProductHubMarketplaceScreen.tsx`; product screens | Product Hub and modules | `ModulaTextInput`, `ModulaButton`, `ModulaMenu`, `ModulaSheet`, `ModulaProgress` | Yes/partial | Native input and confirmation states | Product cards stay branded; chrome becomes native | Medium | Checkpoint B/C after contracts. |
| P1 | Profile edit fields | `src/features/profile/screens/EditProfileScreen.tsx`; editor components | Profile edit | `ModulaTextInput`, `ModulaButton`, `ModulaMenu`, `ModulaSheet` | Yes | Better forms and secure focus | Public profile stays custom | Medium | Move editable fields to native forms; keep header presentation custom. |
| P1 | Privacy / permissions forms | `src/features/product/screens/PermissionsMatrixScreen.tsx`; Settings privacy screens | settings, modules, permissions | `FieldGroup`, `ListItem`, `Switch`, `Picker`, `Button` | Yes | Better state announcement | More coherent settings product | Medium | Migrate after policy contract inspection. |
| P1 | Direct RN `Switch` in product screens | `BlockStudioList.tsx`, `AgentsStudioScreen.tsx`, `AutomationsStudioScreen.tsx`, `ChatAssistScreen.tsx`, `FeatureControlScreen.tsx`, `FocusModeScreen.tsx`, `GaiaConsoleScreen.tsx`, `CustomizeProfileScreen.tsx`, `AppearanceLabScreen.tsx` | Product/admin/developer controls | `ModulaSwitch` | Yes | Native role/state | Native toggles | Low/medium | Replace where the switch mutates real state; hide dead controls first. |
| P1 | Direct RN `TextInput` in social/product screens | composer, search, Product Hub, profile, settings, social sheets | Composer, Search, Profile edit, Settings, Share sheet | `ModulaTextInput` | Yes | Better keyboard/input behavior | Native fields in forms; composer may need custom RN for rich text | Medium/high | Auth/profile/settings first. Composer remains custom until mention/media contracts are stable. |
| P1 | Share sheet | `src/features/social/sheets/ShareToSheet.tsx` | social share | `ModulaSheet`, `ModulaButton`, `ModulaMenu` | Yes | Better action discoverability | Native sheet plus Modula rows | Medium | Replace with `ModulaShareSheet` after sharing data model is stable. |
| P1 | Progress/loading controls | `ModulaProgress`; custom loaders | story upload, module install, AI actions | `ModulaProgress` -> SwiftUI `ProgressView` / fallback | Partial | Progress must expose label/value | Native progress for real upload/install state | Medium: fake progress must be removed | Use only for real progress or indeterminate loading. |
| P2 | Developer/admin screens using `AppButton` | many `src/features/product/screens/*` files | Product/internal tools | `ModulaButton` | Yes | Better buttons | Native chrome where appropriate | Low/medium | P2 after social path. |
| P2 | Custom chips/pills | `AppChip`, `Pill`, product/category chips | Discover, Profile, tags | no direct Expo UI replacement; maybe `Picker`/`SegmentedControl` only for exclusive choices | Partial | Can improve labels but may harm density | Product style should remain custom | Low | Keep chips when multi-select/scrolling/product identity matters. |
| P2 | Custom tab/motion components | `src/platform/ui/tabs/*`; `ReelsModeSwitcher.tsx` | Reels, section tabs | segmented adapter only when 2-4 exclusive choices | Yes where segmented | Better role where exclusive | Avoid generic tabs for product/player UI | Medium | Do not replace shell or reels player tabs without proof. |

## Required Canonical Controls

Phase 7H target adapter folder:

`src/platform/ui/expo/`

Required adapter names from the phase brief:

- `expo-host.tsx`
- `expo-button.tsx`
- `expo-switch.tsx`
- `expo-checkbox.tsx`
- `expo-slider.tsx`
- `expo-segmented-control.tsx`
- `expo-text-input.tsx`
- `expo-picker.tsx`
- `expo-menu.tsx`
- `expo-bottom-sheet.tsx`
- `expo-list.tsx`
- `expo-field-group.tsx`
- `expo-progress.tsx`
- `expo-icon.tsx`
- `index.ts`

Existing public Modula component names must remain stable:

- `ModulaButton`
- `ModulaSwitch`
- `ModulaSegmentedPicker` / `ModulaSegmentedControl`
- `ModulaTextInput`
- `ModulaMenu`
- `ModulaSheet` / `ModulaBottomSheet`
- `ModulaCheckbox`
- `ModulaProgress`

Decision: add/consolidate `src/platform/ui/expo/` as an internal adapter layer under existing public Modula controls during Checkpoint B. Do not move feature imports directly to this folder.

## Segmented Control Canonicalization

Required Phase 7H surfaces:

| Surface | Choices | Existing path | Query/state requirement |
| --- | --- | --- | --- |
| Home | Following, For You, Modules | `src/features/feed/screens/HomeFeedScreen.tsx` | Selected state drives feed mode query. |
| Activity | All, Mentions, Modules | `src/features/activity/screens/ActivityScreen.tsx` | Selected state drives notification/activity filter. |
| Product Hub | Discover, Installed, Updates | `src/features/modules/screens/ProductHubMarketplaceScreen.tsx` | Selected state drives module marketplace filter. |
| Appearance | Dim, Dark, OLED | `src/features/settings/screens/AppearanceScreen.tsx` | Selected state mutates real appearance preference. |
| Search | People, Posts, Modules | current search screens use text input and/or custom tabs | Add only when backed by real search scopes. |

Rules:

- 2-4 concise choices.
- No homemade animated pill under the native segmented control.
- Haptic selection feedback via `expo-haptics` where available.
- Dynamic Type must not clip labels.
- Selection changes real app state and query filters.

## Current Risk Summary

1. Existing adapters are useful but not yet shaped as the requested `src/platform/ui/expo/` internal layer.
2. Settings and auth are the highest-value Expo UI migration targets, but Phase 7H-A contracts must be stable first.
3. Direct RN `TextInput` and `Switch` usages remain common in product/admin screens.
4. Broad `AppPressable` usage is not automatically wrong; feed cards, product cards, story rings, tabs, and custom media controls should stay product-native RN components unless they are purely OS controls.
5. Direct SwiftUI imports are currently bounded to platform adapters and dev lab files; this boundary must be kept by a verifier.
