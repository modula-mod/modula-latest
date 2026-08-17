# Phase 7M-B6 Profile pager + avatar pocket

Captured 2026-08-17 on **iPhone 17 Pro Simulator** (`0727E2F0-8528-44DA-9F4C-7B5F7394096B`, iOS 27.0). Local demo-owner session (`@andrei.modula`).

Work branch: `cursor/phase7m-b6-profile-pager-bc99`  
Base: `cursor/phase7m-b6-profile-masterpiece-ce59`

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
| `profile-avatar-pocket-fixed.png` | Owner hero close-up | Avatar seated in the concentric U cradle (`buildAvatarCradleRisePath`). Focus Halo inside `pocketRadius`. `avatarDrop: 0` is optical-only and moves SVG + portrait together |
| `profile-info-pager-metrics.png` | Owner hero, page 01 | Metrics first, vertical picker, ● ○, tabs + first post in the first viewport. Liquid Glass back + Edit/Share/More. NativeTabs |
| `profile-info-pager-about.png` | Attempted page 02 | Maestro can locate `profile-info-indicator-about` but does not fire the RN press, so this frame is still Metrics. Swipe on-device to review bio + two-column metadata |
| `profile-info-pager-followers.png` | Attempted Followers | Same Maestro limitation on the nested metric pan. Default metric remains **Posts** (user default). Code selects Followers via the picker, not a hardcoded 248 |
| `profile-info-pager-scrolled.png` | Scrolled | Sticky collapsed identity, tabs, NativeTabs, last content above the tab bar |
| `profile-info-pager-dark.png` | Dark hero | Canvas, halo, glass cluster, faded metrics, pager dots |
| `profile-info-pager-oled.png` | OLED hero | True-black body, same geometry |
| `profile-pocket-long-name.png` | Long name attempt | Edit Profile save did not persist `Christopher Alexander Johnson` in Maestro. Identity column still wraps; pocket is unchanged |

`tabs-morph-flush.png` is leftover from an earlier masterpiece pass, not this pager capture.

## Geometry

- Canonical source: `profilePocketGeometry()` in `profile-layout.ts`
- SVG owner: `buildAvatarCradleRisePath` via `InvertedSurfaceTransition` in `ProfileHero` (same parent as the portrait)
- Previous bugs: `avatarDrop` moved only the painted avatar; trailing-only quarter left a degenerate left shelf; cover status-bar bleed painted photo under the overlay
- `identityDrop: 8` — name on the raised plateau
- `avatarDrop: 0` — compatibility token, optical only
