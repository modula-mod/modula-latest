# Phase 7M-B4 — navigation prototypes

Do not auto-select. The 7M-B2 floating pill is **not** the winner because text no longer bleeds through it.

| ID | Name | What it is | References | Keep from engineering | Open question for founder |
| --- | --- | --- | --- | --- | --- |
| NAV A | Restrained native | Edge-aware iOS tab bar. Icons + labels. Optional system minimise-on-scroll. Compose in the top trailing or as a tab accessory. | WWDC26 UI layer; Apple Music/TV; Gentler Streak | Safe-area, a11y hit targets, Reduce Motion | Is Modula distinct enough if chrome is fully system? |
| NAV B | Floating Modula | Raised opaque pill + separate compose control. Floats above content. **No sampling blur.** | Instagram 2026 pill; Apple floating UI layer; Linear owned material | Opaque pill (bleed fix), touch targets | Is the pill identity or leftover chrome? |
| NAV C | Spatial / minimal | Compact icon cluster, overflow/chevron expands destinations, possible pinning later. Create may sit top-leading (Linear). | Linear Mobile 2025–2026; Raycast density; iOS minimise | Gesture infrastructure, drawer | Discoverability vs speed |

## Mapping to directions

- Direction A compositions use NAV A.
- Direction B compositions use NAV B.
- Direction C compositions use NAV C.

A later mix (e.g. Direction A content + NAV B) is a founder invention and must be documented as such.

## Shared requirements

- Last feed row must remain reachable.
- Hit targets ≥ 44pt.
- Selected state is not “teal fill on every icon.” Weight, shape, or a small indicator.
- Drawer remains a spatial overlay, not a second app.
- Product Hub is a destination, not a fifth tab that duplicates Explore unless founder chooses that IA.
