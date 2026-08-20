# Phase 7M-B6 — overlay classification

Do not call every overlay a drawer.

| Surface | Kind | Notes |
| --- | --- | --- |
| Main shell navigation | DRAWER | Finger-tracked, velocity finish, focus restore |
| Composer Tools | SHEET | Header / scroll / footer; registered tools only |
| Comments | BOTTOM SHEET | Post-owned closed / peek / partial / full detents; sticky composer |
| Reactions | POPOVER | Post-owned backed reaction set; keyboard alternative |
| Post context actions | CONTEXT MENU | Rail-down gesture or explicit web menu button; Escape returns focus |
| Video full player | FULL_SCREEN_MODAL | Explicit expand only; comments remains the bottom-pull action |
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
