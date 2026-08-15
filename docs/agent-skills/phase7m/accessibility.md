# Accessibility

Hard requirements. Visual similarity never outranks them.

## Baseline

- Dynamic Type / Modula `TextScale` (0.9–1.3) plus OS large text in UI Lab.
- VoiceOver / TalkBack labels on icon-only actions (“Save post”, not “bookmark icon”).
- Decorative glyphs `aria-hidden` / `accessibilityElementsHidden`.
- Web: visible focus, keyboard operation, no nested buttons (7L-B `#418`).
- Contrast on Light, Dim, Dark, OLED, and every Surface Type.
- Errors linked to fields; not colour-only state.
- Sheets: modal focus trap; restore focus on close (web).
- Drawers: when modal-open, do not traverse the obscured screen; Escape closes on web.
- Story viewer: explicit Previous / Next / Close; hold-to-pause cannot be the only pause.
- Post cards: author, media, actions, and menu remain individually operable.
- Reduce Motion: spatial travel becomes fade/instant via Reanimated system preference.
- Reduce Transparency: Surface resolver already forces solid — keep it.

## Apple / Material

Treat Apple Accessibility HIG and Material state guidance as baseline platform behaviour, not optional polish.

## Verification

UI Lab must include large text and Reduce Motion for every P0 primitive. Missing a11y on a “native-looking” control is a failed component, not a follow-up.
