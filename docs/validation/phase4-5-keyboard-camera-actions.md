# Phase 4.5 — Keyboard, camera, post overflow actions

Sibling agent scope on `phase4-5-native-ui-recovery` (does not own native tabs / account panel).

Date: 2026-07-16

## Expo UI skill

Followed `.cursor/skills/modula-ui/SKILL.md`:

- Product screens consume Modula wrappers under `src/platform/ui/`
- No direct `@expo/ui/swift-ui` imports in features
- No Reanimated / third-party sheet or menu packages
- Theme tokens for colours; local/session media only

## Shipped

### Keyboard

- `KeyboardSafeScreen` for Composer + Edit Profile
- `useKeyboardHeight` + `sheetKeyboardBottomInset` for Tools sheet
- `keyboardScrollProps` (`contentInsetAdjustmentBehavior`, interactive dismiss)
- Discard-draft confirmation on Composer Cancel
- Tools sheet respects Reduce Motion (zero-duration animation)
- No custom tab-bar offset added (avoids double inset once NativeTabs land)

### Camera / media presentation

- `captureMediaFromSource` with avatar/cover editing aspects, full-screen camera presentation
- `presentMediaSourceMenu` — Choose Photo / Take Photo / Remove
- Wired into Composer Tools + Edit Profile
- Honest local-session messaging on media failure

### Post overflow actions

Engagement row keeps Reply / Repost / Like / Share / Save.

More (header ellipsis) opens overflow catalog:

- Translate (Preview)
- Copy text
- Copy link
- Share
- Quote (Preview)
- View engagement (Preview)
- Open in browser (link posts)
- Mute (Preview)
- Hide post (Preview)
- Report (Preview)

## Files

- `src/platform/ui/keyboard/*`
- `src/platform/ui/camera/*`
- `src/platform/ui/menus/*`
- `src/features/translate/*`
- `src/features/feed/postActions/*`
- Composer / Edit Profile / Tools drawer / `DemoPostItem` consumers

## Coordination notes

- Phase 4.5 may replace Tools Modal with Modula BottomSheet and upgrade menus to `@expo/ui` hosts — keep these adapters as the product API.
- Do not reintroduce Create as a tab or floating developer gear.
