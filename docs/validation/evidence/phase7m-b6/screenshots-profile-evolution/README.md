# Phase 7M-B6 Profile evolution evidence

Captured 2026-08-16 on **iPhone 17 Pro Simulator** (`0727E2F0-8528-44DA-9F4C-7B5F7394096B`, iOS 27.0). Metro on `cursor/phase7m-b6-profile-evolution-8344`. Local demo-owner session (`@andrei.modula`).

`01` / `03` / `06` / `07` were recaptured after owner **Edit Profile** moved into the cover glass group (pencil + share + more). There is no in-hero Edit pill.

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
FOUNDER VISUAL APPROVAL = PENDING
```

## What the first shot set got wrong

Those files were not OK:

1. Cover inverted path used `cornerRadius={0}` and drew a jagged white blob behind Edit Profile
2. Metric picker used `InvertedSelectedSurface` (bitten gray pill) with neighbor opacity 0.25
3. Sticky tabs sat at y=0 under the Dynamic Island (Reanimated padding is ignored on iOS sticky clones)
4. `03` was a duplicate of `01`; `06` / `07` were still Light and showed a scrolled media post
5. Owner Edit sat as a separate pill beside the avatar instead of in the cover control group

## What to look at now

| File | Surface | What to look at | Status |
| --- | --- | --- | --- |
| `01-profile-owner-empty-cover.png` | Owner / empty cover | Edit + Share + More in one glass group; no hero Edit pill; canvas lip; rounded picker | Recaptured |
| `02-profile-owner-photo-cover.png` | Owner / photo cover | Photo under status bar | **Not captured** — demo owner has no `coverUri` |
| `03-profile-metric-picker.png` | Metric picker | Wheel after an up-swipe; selected surface is a rounded muted rect, not a bitten pill | Recaptured |
| `04-profile-metric-customize.png` | Customize | Profile Metrics shown list, default metric, Focus Halo | Recaptured |
| `05-profile-scrolled-tabs.png` | Scrolled | Sticky tabs below the island, NativeTabs still present | Recaptured |
| `06-profile-dark.png` | Dark | Owner header in Dark — three-slot glass group | Recaptured |
| `07-profile-oled.png` | OLED | Owner header in OLED — three-slot glass group | Recaptured |

## Known limitations

- Founder visual approval is still required
- Photo-cover shot depends on a locally set cover; this demo owner has none
- Compact identity header during collapse was omitted to avoid a second drifting header
- Module-contributed metrics are registry-ready only; no speculative backend
