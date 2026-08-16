# Phase 7M-B6 — overlay classification

Do not call every overlay a drawer.

| Surface | Kind | Notes |
| --- | --- | --- |
| Main shell navigation | DRAWER | Finger-tracked, velocity finish, focus restore |
| Composer Tools | SHEET | Header / scroll / footer; registered tools only |
| Comments | SHEET | Existing |
| Reactions | POPOVER | Existing proximity row |
| Module install / permissions | SHEET | Large detent when complex; fixed Install footer |
| Module settings | ROUTE | `/settings/modules/[id]` |
| Appearance | ROUTE | Existing Appearance |
| Profile customization | ROUTE | Existing profile |
| Preview lightbox | FULL_SCREEN_MODAL | Escape / tap scrim |

## Stress policy

Sheets: open/dismiss, detent, long permissions, large text, screen reader. Install CTA always reachable.

Drawers: open/close/drag/cancel/rapid repeat. No freeze, no invisible overlay.

## Layers

`src/theme/tokens/layers.ts`: content → raisedContent → sticky → navigation → popover → sheet → dialog → toast.
