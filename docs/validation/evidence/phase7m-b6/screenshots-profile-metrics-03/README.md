# Phase 7M-B6 Metrics micro pass 03

Captured 2026-08-17 on **iPhone 17 Pro Simulator** (`0727E2F0-8528-44DA-9F4C-7B5F7394096B`, iOS 27.0). Local demo-owner session (`@andrei.modula`).

Work branch: `cursor/phase7m-b6-true-split-overview-543f`

This folder is the founder visual set for Metrics picker micro pass 03 only.
Compare against `screenshots-profile-label-chrome/` (current PR #29 baseline) and
`screenshots-profile-metrics/` (micro pass 01). Do not overwrite those sets.

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
FOUNDER VISUAL APPROVAL = PENDING
```

## Scope

Metrics picker only. About, pager, snapshot height, identity, cover, pocket,
Liquid Glass, lower tabs, and NativeTabs are frozen. Empty Overview vertical
space is the next micro-pass.

## Founder set

| File | Surface | What to look at |
| --- | --- | --- |
| `metrics-light.png` | Light Overview, Posts selected | Focal `4` / Posts between short hairlines. Followers secondary. No Metrics heading |
| `metrics-followers-selected.png` | Light, Followers selected | Focal slot stays put. Posts above, Following below, both readable and inactive |
| `metrics-dark.png` | Dark Overview | Neighbors remain visible. Hairlines define the zone, not table rows |
| `metrics-oled.png` | OLED Overview | True-black body. Neighbors do not disappear. Subtle focal rules still visible |

## Honest notes

- Selected value is heavier and larger than neighbors. Labels sit immediately under values.
- Neighbor opacity is 0.72 with secondary colour so dark/OLED stay readable.
- Hint arrows are shorter. The picker is not taller. Snapshot height was not changed.
- VoiceOver still exposes the Metrics column header and the adjustable picker.

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
FOUNDER VISUAL APPROVAL = PENDING
```
