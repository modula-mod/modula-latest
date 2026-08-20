# Phase 7M-B6 true split Overview

Captured 2026-08-17 on **iPhone 17 Pro Simulator** (`0727E2F0-8528-44DA-9F4C-7B5F7394096B`, iOS 27.0). Local demo-owner session (`@andrei.modula`).

Work branch: `cursor/phase7m-b6-true-split-overview-543f`  
Base: `cursor/phase7m-b6-profile-pager-bc99`

This folder is the founder visual set for the true split Overview pass. Do not mix it with `screenshots-profile-snapshot/`.

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
FOUNDER VISUAL APPROVAL = PENDING
```

## Architecture

```
Outer pager:   01 Overview  →  02 Modules  →  03 Links
Overview:      Metrics column  |  About column   (always together)
Lower tabs:    Posts · Media · About · Modules · Links · Shop · Agents
```

Semantic overlap is intentional:

- **Overview About** = compact summary beside Metrics
- **Lower About tab** = expanded profile information
- **Outer Modules** = snapshot
- **Lower Modules tab** = full module surface
- **Outer Links** = snapshot
- **Lower Links tab** = full links collection

There is no inner Metrics/About pager and no inner dots.

## Founder set

| File | Surface | What to look at |
| --- | --- | --- |
| `profile-overview-split-light.png` | Owner hero, Light Overview | Metrics left, About right, both visible. No inner switcher or inner dots. Compact outer nav. Lower tabs and first post in the first viewport |
| `profile-overview-split-dark.png` | Dark Overview | Same split. Adjacent metrics remain legible |
| `profile-overview-split-oled.png` | OLED Overview | True-black body. Split + glass chrome preserved |
| `profile-overview-split-modules.png` | Outer Modules page | `02 Modules` `2 / 3`. Compact public module preview. View all modules |
| `profile-overview-split-links.png` | Outer Links page | `03 Links` `3 / 3`. Compact link preview. View all links |
| `profile-overview-split-first-viewport.png` | First viewport | Cover, pocket, name, Overview split, outer nav, lower tabs, start of first post |
| `profile-overview-split-large-type.png` | Extra Extra Extra Large | Stacked Metrics then About on the same Overview page. No exclusive switcher. Picker rows do not overlap |

## Honest notes

- Outer page changes were validated by swiping the snapshot region. Labeled nav remains the primary control.
- Owner Overview still shows visibility as the product default (`Public`) because `ModulaProfile` has no profile-level visibility field yet. Visitors omit that cell.
- Large Dynamic Type stacks the columns. Metrics item height scales with font scale so values do not collide.
- Cover, avatar pocket, Liquid Glass back, and the Edit/Share/More group were not retuned in this pass.

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
FOUNDER VISUAL APPROVAL = PENDING
```
