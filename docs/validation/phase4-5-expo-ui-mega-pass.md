# Phase 4.5 — Expo UI mega-pass validation

Branch: `phase4-5-native-ui-recovery`

## Surfaces upgraded

| Surface | Changes |
|---|---|
| Platform sheets | `ModulaSheet` (Expo BottomSheet on iOS); `SelectionSheet` helper |
| Menus | `ModulaContextMenu` (SwiftUI ContextMenu on iOS), `ModulaMenu`, `ModulaControlGroup`, `ModulaDisclosureGroup` |
| Composer | Premium layout: audience / reply / CW sheets, undo/redo, icon toolbar, Drafts, thread Preview, Tools sheet |
| Share | `ShareToSheet` + `/share` modal (search people, copy, Share via…) |
| Messages | Search, All/Unread/Pinned, context menus, compose FAB → new-message sheet |
| Account panel | Primary vs Settings/Help hierarchy, stats, switcher + quick appearance |
| Activity | All/Mentions pills, settings gear, row context menus |
| Discover | Interests / feeds / media routes, Hot topic context menus |
| Post detail | Sticky reply bar → Composer reply mode, header More, reply context menus |
| Settings | Search settings, status values, DisclosureGroup advanced notes |
| Marketplace detail | ControlGroup Install/Edit/Remove Preview |
| Tabs | Liquid-glass expandable bar when native module linked; **NativeTabs fallback** in Expo Go |

## Verifiers

- `pnpm typecheck`
- `pnpm verify:phase4`
- `pnpm verify:phase4-5`

## Liquid glass tabs

See `docs/validation/phase4-5-liquid-glass-tabs.md`. Rebuild required for full chrome:

```bash
cd ios && pod install && cd ..
pnpm exec expo run:ios
```

## Preview-only (honest labels)

Audience Inner Circle / Modules, content warnings, GIF/location/circle tools, DM share, pin/mute/delete chats, feed pins, interests sync, module install/remove, thread composer extras.
