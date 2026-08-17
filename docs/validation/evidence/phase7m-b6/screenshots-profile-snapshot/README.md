# Phase 7M-B6 nested Profile snapshot pager

Captured 2026-08-17 on **iPhone 17 Pro Simulator** (`0727E2F0-8528-44DA-9F4C-7B5F7394096B`, iOS 27.0). Local demo-owner session (`@andrei.modula`).

Work branch: `cursor/phase7m-b6-profile-pager-bc99`  
Base: `cursor/phase7m-b6-profile-masterpiece-ce59`

This folder is the founder visual set for the nested snapshot pager rebuild. Do not mix it with `screenshots-profile-masterpiece/`.

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
FOUNDER VISUAL APPROVAL = PENDING
```

Upper snapshot = compact preview. Lower Profile tabs = full destination. Semantic overlap (About / Modules / Links) is intentional.

## Nested architecture

```
Outer:  Overview → Modules → Links
Inner, inside Overview only:  Metrics ↔ About
```

Fresh entry: outer = Overview, inner = Metrics.

## Founder set

| File | Surface | What to look at |
| --- | --- | --- |
| `profile-snapshot-overview-metrics.png` | Owner hero, Overview / Metrics | No grey card. `01 Overview` `1 / 3`. Metrics underline. Centered vertical picker (4 Posts selected, faded neighbors). Inner `● ○`. Labeled outer nav. Lower tabs + first post. Glass back + Edit/Share/More. NativeTabs |
| `profile-snapshot-overview-about.png` | Owner hero, Overview / About | `01 Overview`. About underline. Bio visible. 2×2 metadata (Joined, UK, modula.digital, Public). Inner `○ ●`. Outer nav still Overview |
| `profile-snapshot-modules.png` | Owner hero, Modules | `02 Modules` `2 / 3`. Compact public module preview (Vault Notes, Tasks, CRM, Automations). View all modules. Outer nav Modules selected |
| `profile-snapshot-links.png` | Owner hero, Links | `03 Links` `3 / 3`. Compact link preview (Modula, GitHub, Build updates). View all links. Outer nav Links selected |
| `profile-snapshot-scrolled.png` | Scrolled | Sticky collapsed identity, lower tabs, NativeTabs, content above the tab bar |
| `profile-snapshot-dark.png` | Dark hero | Dark canvas, Overview / Metrics, glass cluster, halo, nested pager |
| `profile-snapshot-oled.png` | OLED hero | True-black body (`#000000`), Overview / Metrics |

## Honest notes

- Outer page changes were validated by swiping the snapshot header. The sticky Profile tabs overlay used to steal taps on the labeled outer nav; this pass sets `pointerEvents="box-none"` and keeps the snapshot above that spacer.
- Module preview uses canonical public profile module data (name + description). It does not invent counts such as “24 notes”.
- Link preview uses canonical labels + domains, not raw URL-only rows.
- CRM appears in the owner Modules snapshot because its demo visibility is `followers` and the viewer is the owner.

## Geometry

Canonical pocket source remains `profilePocketGeometry()` in `src/features/profile/model/profile-layout.ts`. This mission does not retune the cover, avatar pocket, or Liquid Glass chrome.
