# Phase 7M-B — Shared visual primitive dispositions

Date: 2026-08-15
Branch: `cursor/phase7m-b-ui-system-module-runtime-103e` (from 7M-A head `b62fef9`)

Decision vocabulary (mission): `KEEP` | `EXTEND` | `CONSOLIDATE` | `REPLACE` | `DELETE_AFTER_MIGRATION`.

The one-direction dependency rule is binding:

```text
screens → Modula semantic components → platform adapters → Expo / RN / native
```

## Foundations

| Primitive | Owner | Disposition | 7M-B action |
| --- | --- | --- | --- |
| Appearance runtime | `src/theme/runtime/AppearanceProvider.tsx` | KEEP | none (no second provider) |
| Theme tokens (`useThemeTokens`) | `src/theme/runtime/` | KEEP | none |
| `SurfaceType` union | `src/theme/contracts/appearance.ts` | KEEP | none (no parallel union) |
| Material resolver | `src/theme/materials/resolveMaterialTokens.ts` | EXTEND | keep reduce-transparency → solid invariant; verify OLED canvas |
| `MaterialSurface` | `src/components/materials/` | KEEP | none |
| Typography contracts | `src/theme/contracts/typography.ts` | EXTEND | add semantic aliases (`titleLarge`, `title`, `metadata`, `button`) mapped onto existing roles — one source of truth |
| Legacy `src/theme/foundations/typography.ts` | foundations | DELETE_AFTER_MIGRATION | not the runtime path; keep until 7M-C confirms no importers |
| Legacy `src/theme/tokens/*` stubs | `src/theme/tokens/` | DELETE_AFTER_MIGRATION | parallel stub set; runtime uses contracts + materials |
| Spacing / radius scales | `src/theme/foundations/spacing.ts`, `radius.ts` | KEEP | canonical; no new scale |
| Motion tokens | `contracts/materials.ts` + `data/defaults.ts` | EXTEND | add `micro` and `overlay` durations + `spatial` spring; semantic aliases quick→fast, standard→normal, expressive→slow; migrate primitive-level hard-coded timings |

## Icons

| Primitive | Owner | Disposition | 7M-B action |
| --- | --- | --- | --- |
| `AppIcon` (Ionicons) | `src/components/primitives/AppIcon.tsx` | CONSOLIDATE | remains legacy substrate during migration; new UI uses `ModulaIcon` |
| `SF_SYMBOL_FOR_ICON` | `src/platform/ui/buttons/sf-symbol-for-icon.ts` | CONSOLIDATE | absorbed into the `ModulaIcon` registry (complete map, no `'circle'` silent fallback for registered names) |
| `ModulaIcon` (new) | `src/components/primitives/ModulaIcon.tsx` | — | canonical semantic registry: iOS → SF Symbol, Android/web → Modula-owned SVG (react-native-svg, already installed). No icon font for new UI. Unknown names fail typecheck. |

## Controls (canonical home `src/platform/ui`)

| Contract | Owner today | Disposition |
| --- | --- | --- |
| ModulaButton | `platform/ui/buttons/modula-button.tsx` | KEEP / EXTEND (loading/press motion tokens) |
| `AppButton` | `components/primitives/AppButton.tsx` | DELETE_AFTER_MIGRATION (legacy parallel; auth screens migrate in 7M-B) |
| ModulaIconButton | `platform/ui/buttons` | KEEP |
| ModulaTextField | `platform/ui/controls/modula-text-input.tsx` | KEEP / EXTEND (label / support / error slots) |
| ModulaSecureField | `platform/ui/controls/modula-secure-input.tsx` | KEEP / EXTEND (show/hide affordance) |
| ModulaOTPField | none | NEW composite over native text input (per 7M-A contract INSPIRATION_ONLY) |
| ModulaSearchField | `components/primitives/AppSearchField.tsx` | CONSOLIDATE behind `platform/ui` export |
| ModulaSegmentedControl | `platform/ui/controls/modula-segmented-picker.tsx` | KEEP |
| ModulaSwitch | `platform/ui/controls/modula-switch.tsx` | KEEP |
| ModulaMenu / ModulaContextMenu | `platform/ui/menus/` | KEEP |
| ModulaPopover | web/overflow menus | EXTEND (accessible positioning; Escape dismissal) |
| ModulaDialog | `platform/ui/menus/modula-confirmation-dialog.tsx` | KEEP / EXTEND (web focus trap proof) |
| ModulaSheet | `platform/ui/sheets/` | KEEP / EXTEND (Reduce Motion path) |
| Drawer | `src/shell/NavigationDrawer.tsx` | KEEP |
| Bottom navigation | `platform/ui/navigation/platform-tabs.*` | KEEP |

## Presentation / duplicates

| Primitive | Duplicates | Disposition |
| --- | --- | --- |
| Avatar | `Avatar.tsx` vs `AppAvatar.tsx` | CONSOLIDATE → `Avatar` (expo-image backed); `AppAvatar` DELETE_AFTER_MIGRATION |
| Divider | `Divider.tsx` vs `AppDivider.tsx` | CONSOLIDATE → `Divider`; `AppDivider` DELETE_AFTER_MIGRATION |
| EmptyState | `EmptyState.tsx` vs `AppEmptyState.tsx` | CONSOLIDATE → `EmptyState`; `AppEmptyState` DELETE_AFTER_MIGRATION |
| `FeedPostRow` | legacy stub, unused | DELETE_AFTER_MIGRATION |

## Product-owned primitives (7M-C migration surface; 7M-B flagship touch only)

| Primitive | Owner | Disposition |
| --- | --- | --- |
| PostCard | `features/social/components/social-post.tsx` | KEEP (flagship Home refinement in place; not a generic Card) |
| Stories rail / viewer | `features/presence/` | KEEP |
| ModuleCard | `features/modules/components/ModuleCatalogueCard.tsx` | EXTEND (marketplace hierarchy; debug fields → Trust & Technical Details) |
| ModuleStatusPill | `features/modules/components/ModuleStatusPill.tsx` | KEEP / EXTEND (state coverage, not colour-only) |
| Module Host | `features/modules/runtime/module-host.tsx` | KEEP (generic; no vault hardcoding) |
| UI Lab | `platform/ui/dev/expo-ui-lab/` | EXTEND (Modula UI Lab sections; no new unrelated lab) |

## Prohibited in 7M-B (re-affirmed)

No `packages/ui`, no second ThemeProvider/AppearanceProvider/Surface context, no new icon font,
no FlashList/TrueSheet/Gorhom/Radix/Moti installs without demonstrated missing capability + admission,
no `@expo/ui` imports from product screens.
