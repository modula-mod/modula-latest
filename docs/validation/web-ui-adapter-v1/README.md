# Web UI Adapter V1 evidence

## Drawer hierarchy correction

- `rejected-nested-drawer-390-before.png` and `rejected-nested-drawer-430-before.png`: rejected failure baseline with two visibly competing drawer surfaces.
- `drawer-root-390-light.png`: one Tools shell, overlay, and handle.
- `drawer-formatting-390-light.png`: same shell after Tools to Formatting.
- `drawer-font-390-light.png`: same shell after Formatting to Font.
- `drawer-back-tools-390-light.png`: restored root state after Back twice.
- `drawer-formatting-430-dark.png`: dark-mode drill-in state.
- `true-nested-modal-430-oled.png`: deliberately separate modal task; parent recedes and the child is portalled as a sibling layer.
- `drawer-input-keyboard-430-dark.png`: input focus and persistent footer geometry.
- `drawer-long-child-430-dark.png`: long body scrolled within the one Drawer body.
- `drill-in-desktop-1024.png`: the same navigator resolved to a desktop Dialog shell.
- `ui-lab-1440.png`: full desktop adapter matrix.
- `navigation-chrome-430-dark.png`: equal Back and More geometry with shared blurred chrome.
- `activity-filter-390-dark.png`: the real Activity More menu handed off to its working filter Drawer.
- `profile-more-390-dark.png`: the real visitor Profile More menu with share, copy, moderation, and report actions.
- `drawer-drill-in-flow-390.webm`: open, push twice, select, pop twice, and drag-close interaction recording.

The Playwright suite asserts one visible Drawer popup, backdrop, handle, and scrolling body throughout ordinary drill-in navigation. For true nesting it asserts two portal-level modal popups, one visible foreground handle, a receded parent, and that the child popup is not contained by the parent Drawer body.

The shared chrome/action correction additionally asserts equal Back and More hit geometry, a computed backdrop blur, menu selection and focus return, responsive legacy action presentation, and menu-to-confirmation handoff. Profile, feed, settings, and context actions remain routed through semantic Modula adapters rather than screen-level web primitives.

These Chromium artifacts do not replace installed-iPhone PWA, VoiceOver, Dynamic Type, Safari keyboard, or founder visual acceptance.
