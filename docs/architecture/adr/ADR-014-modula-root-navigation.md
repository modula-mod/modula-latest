# ADR-014: Modula Root Navigation

Date: 2026-07-26
Status: Accepted for Phase 7C

## Context

Phase 7C requires five root destinations:

- Home
- Discover
- Create
- Activity
- Profile

Secondary global destinations:

- Board
- Product Hub
- Saved
- Settings

The current repository is Expo SDK 57 with:

- `expo-router ~57.0.8`
- `@expo/ui ~57.0.7`
- `react-native 0.86.0`
- existing platform adapters under `src/platform/ui/**`
- a restored `NavigationDrawer`
- root-level `PersistentShellTabBar`
- guarded native liquid-glass tab bar support
- Expo Router `NativeTabs` fallback

## Candidates

### Candidate A: Expo Router Native Tabs Only

Strengths:

- native platform tab behavior
- SDK 57 compound trigger API is installed
- system tab accessibility and safe-area behavior where supported
- simpler native fallback when custom liquid glass is unavailable

Risks:

- root-level custom Create geometry is limited
- custom drawer/chrome integration would need additional route and overlay testing
- switching solely to Native Tabs would remove the Phase 7B validated custom bottom-chrome contract
- web still needs a separate implementation

### Candidate B: Existing Validated Custom Shell With Native Tabs Fallback

Strengths:

- preserves the Phase 7B bottom-chrome contract
- keeps the restored drawer model
- supports central Create as a platform-adapted action in custom native builds
- already guards liquid-glass native module availability
- falls back to Expo Router Native Tabs when custom native glass is unavailable
- keeps web on a functional adaptive rail/bottom bar
- keeps SwiftUI/Compose imports behind platform adapters

Risks:

- more code than pure Native Tabs
- custom chrome requires ongoing safe-area, keyboard, and accessibility verification
- route/tab preferences must be migrated so Board is no longer a permanent root tab

## Decision

Use Candidate B for Phase 7C:

- preserve the existing Modula shell and drawer
- keep Expo Router Native Tabs as the native fallback
- keep web on the custom adaptive rail/bottom bar
- migrate the canonical root tabs to Home, Discover, Create, Activity, Profile
- move Board, Product Hub, Saved, and Settings to drawer/secondary access
- keep Create as the central action where the custom shell supports it

## Implementation Notes

Changed root tab source:

- `src/platform/ui/navigation/modula-tabs.ts`
- `src/features/product/data/layoutBlocks.ts`
- `src/features/product/data/resolveTabBar.ts`
- `src/features/product/storage/productPreferencesStorage.ts`

Changed shell adapters:

- `src/platform/ui/navigation/platform-tabs.native.tsx`
- `src/platform/ui/navigation/platform-tabs.web.tsx`
- `src/platform/ui/navigation/modula-liquid-glass-tab-bar.tsx`
- `src/platform/ui/navigation/shell-tab-bar-visibility.ts`

Changed drawer language:

- `src/shell/NavigationDrawer.tsx`
- `src/platform/ui/navigation/account-panel-destinations.ts`

## Consequences

- Board remains routable at `/board`, but it is not a permanent bottom tab.
- Create remains routable at `/(tabs)/create` and redirects to `/compose`.
- Native builds with the custom liquid-glass module use the floating plus button for Create.
- Native fallback builds expose Create through Native Tabs.
- Web exposes Create in the root tab set and Board in the wide rail secondary section.
- Product Hub is the user-facing module catalogue name.

## Validation Requirements

Before merging Phase 7C:

- `pnpm lint`
- `pnpm typecheck`
- `node scripts/verify-phase7c-product-shell.mjs`
- browser screenshots for 390x844, 430x932, 768x1024, and 1440x900
- iOS development build run
- simulator acceptance
- physical iPhone acceptance

The VPS web export does not validate SwiftUI, Native Tabs, or custom native liquid glass behavior.
