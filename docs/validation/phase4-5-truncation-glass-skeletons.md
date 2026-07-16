# Phase 4.5 — Truncation, glass, skeletons (UI bug recovery)

Evidence screenshots: `docs/validation/phase4-5-ui-bugs/`.

## Before (Simulator 2026-07-16)

| Shot | Defect |
|---|---|
| `01-activity-broken.png` | Activity rows crushed into a narrow column; overlapping text; truncated View/Open/Preview pills; stray gear |
| `02-board-double-bars.png` | Floating liquid-glass bar **plus** Create/Discover/Profile strip; blue gear FAB; cards clipped |
| `03-account-panel-truncated.png` | Mid-word subtitle ellipsis; opaque sheet; gear over chrome |
| `04-post-options-actionsheet.png` | Custom ActionSheet stack instead of ContextMenu / Menu |
| `05-profile-modules-clipped.png` | Modules cards under tab bar; gear on tabs |

## After (code)

### Liquid glass tabs

- Primary bar remains `ModulaLiquidGlassTabBar` + `@callstack/liquid-glass` when `NativeLiquidGlassModule` is present; Reduce Transparency → solid fallback.
- Expand menu: Compose, Messages, Marketplace, Search/Discover, Drafts (Create is **not** a tab).
- Shared `useFloatingTabBarContentPadding()` applied to Home, Activity, Board, Profile, Discover.
- Board **removed** the Create/Discover/Profile quick-action strip (was the double bar).

### Gear

- Not a Modula JS FAB. Expo Dev Client tools bubble hidden via:
  - `app.config.ts` → `expo-dev-client` `toolsButton: false` (needs rebuild for full effect)
  - `hideExpoDevToolsButton()` at root launch (`DevMenuPreferences.showFloatingActionButton: false`)
- Developer entry remains Settings → Developer (dev builds) / shake menu.

### Pages

- **Activity**: full-width rows (avatar \| content); section headers; trailing action pills removed; ContextMenu for Open / Mark read / Mute / Copy / Remove; filter sheet + mark-all-read.
- **Board**: customize pinned spaces sheet; ContextMenu on pins; ControlGroup on modules; correct bottom inset; no secondary tab strip.
- **Account panel**: 2-line subtitles; shorter copy; glass BlurView material when Reduce Transparency off; taller initial detent (`0.72`).
- **Profile Modules**: tab-bar-aware scroll padding; module ContextMenu + ControlGroup.

### Context menus

- Posts: long-press `ModulaContextMenu` + More `ModulaMenu` (Expo UI) — no ActionSheet for feed overflow.
- Also: Activity rows, Board pins, Profile modules, story avatars, Discover topics, Messages threads.

### Skeletons (`src/platform/ui/skeletons/`)

| Component | Surfaces |
|---|---|
| `FeedPostSkeleton` | Home initial load |
| `ActivityListSkeleton` | Activity initial load |
| `BoardGridSkeleton` | Board while queries load |
| `ProfileHeroSkeleton` | Profile initial load |
| `MessagesRowSkeleton` | available for Messages refresh paths |

Shimmer uses RN `Animated` only when Reduce Motion is off; otherwise static token blocks.

### Animations (no product Reanimated)

- Tab expand/spring stays in liquid-glass adapter (authorized).
- Sheet present/dismiss via Expo UI BottomSheet.
- Feed/Activity filter changes: `LayoutAnimation`.
- Press feedback: `AppPressable`.
- Profile content tabs: `ModulaMotionTabs`.

## Manual smoke

1. Rebuild or relaunch: confirm no floating blue gear.
2. Board: only one bottom chrome; last cards scroll clear.
3. Activity: full-width readable rows; long-press menu.
4. Post More: Expo Menu / ContextMenu, not ActionSheet stack.
5. Account panel: readable 2-line subtitles; glass tint when allowed.
6. Profile Modules: last card clears tab bar.
