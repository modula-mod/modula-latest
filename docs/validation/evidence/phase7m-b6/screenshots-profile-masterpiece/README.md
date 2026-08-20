# Phase 7M-B6 Profile pager + avatar pocket

Captured 2026-08-17 on **iPhone 17 Pro Simulator** (`0727E2F0-8528-44DA-9F4C-7B5F7394096B`, iOS 27.0). Local demo-owner session (`@andrei.modula`).

Work branch: `cursor/phase7m-b6-profile-pager-bc99`  
Base: `cursor/phase7m-b6-profile-masterpiece-ce59`

This recapture is after matching the founder visual target: tighter pocket, verified name, and a two-column **01 Metrics / 02 About** panel.

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
FOUNDER VISUAL APPROVAL = PENDING
```

There is no `modula-profile-andrei.yaml`. Layout tokens live in `src/features/profile/model/profile-layout.ts`.

Hero About in the pager is a compact identity summary. The top-level Profile **About** tab remains the full expanded profile. They are not synced.

## Founder set (this pass)

| File | Surface | What to look at |
| --- | --- | --- |
| `profile-avatar-pocket-fixed.png` | Owner hero close-up | Avatar seated in the concentric U cradle. Verified check on Andrei. `cradleGap: 2`, `avatarFit: 0.98`, `avatarBorder: 4`. Focus Halo inside `pocketRadius` |
| `profile-info-pager-metrics.png` | Owner hero, page 01 | Rounded hairline panel, **01 Metrics** underline, left picker (4 Posts selected with accent dot, Followers, Following, Modules), right destination rows, ● ○, tabs + first post, Liquid Glass back + Edit/Share/More, NativeTabs |
| `profile-info-pager-about.png` | Owner hero, page 02 | Tapping `profile-info-chrome-about` now switches the page. **02 About** underline, two-column metadata (Joined, website, location, Public), second pager dot active |
| `profile-info-pager-scrolled.png` | Scrolled | Sticky collapsed identity, tabs, NativeTabs, last content above the tab bar |
| `profile-info-pager-dark.png` | Dark hero | Dark canvas, halo, glass cluster, two-column Metrics panel, pager dots |
| `profile-info-pager-oled.png` | OLED hero | True-black body (`#000`), same geometry, Metrics page 01 |

`profile-info-pager-followers.png` and `profile-pocket-long-name.png` are leftover from the previous pager pass. Do not treat them as this recapture.

`tabs-morph-flush.png` is leftover from an earlier masterpiece pass, not this pager capture.

## Geometry

- Canonical source: `profilePocketGeometry()` in `profile-layout.ts`
- SVG owner: `buildAvatarCradleRisePath` via `InvertedSurfaceTransition` in `ProfileHero` (same parent as the portrait)
- `identityDrop: 8` — name on the raised plateau
- `avatarDrop: 0` — compatibility token, optical only

## Honest notes

- The right column of page 01 currently shows destination rows (Followers / Following / Modules) more strongly than the featured Posts spotlight copy. Left picker + chrome still match the founder panel.
- Dark About metadata can look tight in the panel; this recapture uses Dark **Metrics** as the dark hero frame.
- OLED canvas samples `#000000` on the body.
