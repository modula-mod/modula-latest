# Phase 7M-B6 Metrics micro pass 01

Captured on **iPhone 17 Pro Simulator** (`0727E2F0-8528-44DA-9F4C-7B5F7394096B`, iOS 27.0). Local demo-owner session (`@andrei.modula`).

Work branch: `cursor/phase7m-b6-true-split-overview-543f`

This folder is the founder visual set for the Metrics picker refinement only.
Do not mix it with `screenshots-profile-split/` and do not overwrite that set.

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
FOUNDER VISUAL APPROVAL = PENDING
```

## Scope

Metrics column only. About, Overview split, outer pager, avatar pocket,
Liquid Glass, lower tabs, and NativeTabs are frozen.

## Founder set

| File | Surface | What to look at |
| --- | --- | --- |
| `profile-metrics-micro-pass-before.png` | Light Overview, pre-change | Baseline from the true-split pass. Selected Posts sits in a static list |
| `profile-metrics-micro-pass-light.png` | Light Overview | Compact picker. Selected Posts in the focal lock. Neighbors subordinate but readable. About unchanged |
| `profile-metrics-micro-pass-followers.png` | Light, Followers selected | Proves the focal slot stays put while another metric is selected |
| `profile-metrics-micro-pass-dark.png` | Dark Overview | Immediate neighbors remain visible. No disabled-looking fade |
| `profile-metrics-micro-pass-oled.png` | OLED Overview | True-black body. No grey slab. Subtle focal separators still visible |
| `profile-metrics-micro-pass-large-type.png` | Extra Extra Extra Large | Scaled rows. No overlap with About. Stacked columns remain on one Overview page |

## Honest notes

- The picker now uses a fixed focal slot: previous / selected / next. The fourth metric is revealed by movement rather than shown as a simultaneous far row.
- Hint arrows stay on the value axis, use tertiary colour, and fade at the ends. They are decorative, not extra hit targets.
- There is still no index rail.

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
FOUNDER VISUAL APPROVAL = PENDING
```
