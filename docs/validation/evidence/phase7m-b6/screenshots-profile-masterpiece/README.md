# Phase 7M-B6 Profile masterpiece evidence

Captured 2026-08-16 on **iPhone 17 Pro Simulator** (`0727E2F0-8528-44DA-9F4C-7B5F7394096B`, iOS 27.0). Metro on `cursor/phase7m-b6-profile-masterpiece-ce59`. Local demo-owner session (`@andrei.modula`).

Baseline before this pass: `docs/validation/evidence/phase7m-b6/screenshots-profile-evolution/`.

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
FOUNDER VISUAL APPROVAL = PENDING
```

## Before → after

| Issue in evolution shots | After this pass |
| --- | --- |
| Avatar covered name / handle / pronouns | Identity starts below the avatar+halo slot (`profileGeometry`) |
| White lip felt like a rectangle with one inverted corner | Cover uses `buildAvatarCradlePath` so canvas hugs the avatar |
| Giant muted grey metric pill | Typography + opacity + scale only; no selected surface |
| Often only one neighbour obvious | Packed 3-row window shows previous/selected/next when they exist |
| Public badge on the hero | Removed from identity; owner visibility lives on About |
| Metadata → website gap | One metadata family (joined + location, then website) |
| Tabs/content started too low | Cover, picker, and identity gaps compressed; first post is in the first viewport |

## Founder set

| File | Surface | What to look at |
| --- | --- | --- |
| `cover-no-bottom-blur.png` | Owner hero (this pass) | No frosted band where the photograph meets the white plateau; status-bar blur stays |
| `picker-center-arrows.png` | Owner hero (previous) | Metric rail gone; numbers centered; 30% arrows above and below the picker |
| `metrics-down-70.png` | Owner hero (previous) | Metric picker dropped another 50pt (70pt total); avatar 60pt, identity 55pt, inverted SVG unchanged |
| `metrics-down-20.png` | Owner hero (previous) | Metric picker dropped 20pt; avatar 60pt, identity 55pt, inverted SVG unchanged |
| `avatar-up-12.png` | Owner hero (previous) | Avatar raised 12pt from the 72pt drop (now 60pt); identity still 55pt down; inverted SVG unchanged |
| `avatar-and-text-lower.png` | Owner hero (previous) | Avatar dropped another 36pt (72pt total); name/handle/bio dropped 55pt; inverted SVG unchanged |
| `avatar-lower.png` | Owner hero (previous) | Avatar dropped 36pt into the white pocket; inverted SVG unchanged |
| `profile-final-photo-cover.png` | Same hero | Progressive blur, status-bar contrast, glass chrome on photography |
| `profile-final-picker-posts.png` | Picker | Posts selected; Followers / Following as downward context; no grey pill |
| `profile-final-picker-followers.png` | Picker | Three-metric wheel (Followers / Following / Modules) |
| `profile-final-picker-modules.png` | Picker + activate | Modules selected; activate opened the Modules tab (selection ≠ navigation) |
| `profile-final-customize-metrics.png` | Customize | Profile Metrics, drag handles, visibility toggles, default metric, Focus Halo |
| `profile-final-scrolled.png` | Scroll | NativeTabs remain; content can sit behind glass. Sticky-tab collapse is implemented in `ProfileShell` (`stickyHeaderIndices`) |
| `profile-final-dark.png` | Dark | Canvas, halo, glass cluster, picker hierarchy |
| `profile-final-oled.png` | OLED | Deeper canvas; same geometry |
| `profile-final-empty.png` | Public / no photo | Gaia quiet cover atmosphere, back control, Following + more, no owner Edit |

`pass2-hero.png` is the same composition as the owner/photo/posts set (first successful iteration after the geometry fix).

## Known limitations

- Founder visual approval is still required
- Maestro swipes on Profile often hit the metric picker or NativeTabs, so a fully collapsed sticky-tab frame was not captured cleanly. The sticky path is unchanged: `stickyHeaderIndices={[1]}` with layout `paddingTop` when the hero has left the viewport
- Module-contributed metrics remain registry-ready only
- Demo owner cover is an Unsplash development photograph so photo-cover review does not depend on an empty grey field
