# Visual verification

Do not accept UI that merely looks attractive in one screenshot.

## Required states (UI Lab / prototypes)

- iPhone 17 Pro Simulator
- Phone-sized web viewport
- Desktop web viewport
- Light, Dark, OLED
- native Surface, solid Surface, glass Surface (and others the component claims)
- Default text and large text
- Reduce Motion enabled where motion materially changes presentation

## Motion

Still screenshots are insufficient for drawer, sheet, reaction picker, Story transition, or tab interaction. Record a short capture.

## Evidence tree (7M-B+)

```text
docs/validation/evidence/phase7m/
├── ui-lab/
├── login/
├── home/
├── stories/
├── comments/
├── profile/
├── settings/
├── product-hub/
└── modules/
```

## Functional gate

Alongside screenshots, prove:

- no React hydration `#418` on web
- no tofu / missing icons
- real API data (no mock product data in acceptance shots)
- accepted 7L-B behaviours still work (login, reload restore, `/profile/:handle`, Settings sessions/mail)

## Human approval

7M-C does not start until Login, Home, and Product Hub prototypes are visually approved.
