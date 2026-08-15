# Phase 7M-B4 — motion references

Capture date: 2026-08-15. Motion explains state. It does not decorate static content. Existing tokens in `docs/design/modula-motion-system.md` remain the implementation vocabulary (Reanimated 4.5.1). This file records **what shipping apps actually do**.

Infrastructure is preserved. No Moti. No new animation library.

---

## Linear Mobile

| Field | Observation |
| --- | --- |
| Source | https://linear.app/now/linear-liquid-glass · https://nelson.co/work/linear-26 · changelog 2025-10-16, 2026-01-22 |
| Gesture | Tap chevron / overflow to expand the bottom bar |
| Trigger | Explicit, not scroll |
| Duration / physics | Designer built a SwiftUI playground to tune springs so the expansion feels “expected on first use” |
| Visual property | Bar width/height and item set; custom frosted material |
| Purpose | Reveal additional destinations / pinned projects without a hamburger |
| Modula adaptation | NAV C only. Expanding chrome is a documented invention if selected. |
| Reduced motion | Instant swap of destinations; no spring |

Linear also rebuilt navigation as part of a **visual system**, not a one-off glass tab. That is the lesson: if Modula keeps a floating pill, it must belong to Direction B’s material language, not to a leftover bugfix.

---

## Instagram

| Field | Observation |
| --- | --- |
| Source | Liquid Glass navbar rollout reporting, 2026-02–04 |
| Gesture | Scroll feed |
| Trigger | Scroll direction |
| Duration / physics | Bar shrinks while scrolling; users report accidental taps on posts |
| Visual property | Translucent pill; icons remain |
| Purpose | Return pixels to media |
| Modula adaptation | Prototype in NAV B. Default should **not** shrink until founder sees mistap risk. |
| Reduced motion | Bar stays expanded; no live blur sampling |

---

## Threads

| Field | Observation |
| --- | --- |
| Source | Refero Threads system; 2026 reply-indent rollout |
| Gesture | Scroll; open replies |
| Trigger | Scroll / navigation push |
| Duration / physics | Feed is mostly static; replies indent rather than exploding into cards |
| Visual property | Hairline separators; low-chrome action press states (grey → ink) |
| Purpose | Keep the document stable; conversation structure is spatial |
| Modula adaptation | Action press uses `motion.micro` / `spring.press` ≤ 2–3% scale. No bounce on every like. |
| Reduced motion | Colour/weight change only |

---

## Airbnb

| Field | Observation |
| --- | --- |
| Source | https://design.google/library/airbnb-invites-you-in |
| Gesture | Tap listing photo |
| Trigger | Navigation to detail |
| Duration / physics | Shared-element: photo enlarges into the destination (brochure metaphor) |
| Visual property | Image frame |
| Purpose | Tell you that this listing is the same object |
| Modula adaptation | Product Hub artwork → module product page; Vault Notes hero → installed document. Use `spring.spatial` or system zoom transition if available through Expo Router / installed SDK. |
| Reduced motion | Cross-fade `standard` |

---

## Apple system apps

| Field | Observation |
| --- | --- |
| Source | WWDC25/26 design sessions; `tabBarMinimizeBehavior` docs |
| Gesture | Scroll, search focus, toolbar morph |
| Trigger | Scroll geometry; focus; navigation |
| Duration / physics | System springs; search field morphs from toolbar button to keyboard-adjacent field |
| Visual property | Liquid Glass chrome, not content |
| Purpose | Content first; tools when needed (Notes tools morph while editing) |
| Modula adaptation | Prefer system search/tab motion in Direction A. Direction B may own a material but should still morph search rather than swap in a second rectangle. |
| Reduced motion | System Reduce Motion; Modula `useReducedMotion` fades |

---

## Install / progress (Modula invention, referenced)

No social app is a module installer. Closest shipping patterns:

| Reference | Pattern | Modula |
| --- | --- | --- |
| App Store | Get → spinner on the same control → Open | Install button becomes progress, then Open |
| iOS downloads | Determinate if duration is known | Preparing → Downloading → Verifying → Installing → Ready |
| App Store Open | Same slot, new verb | Do not jump to “Permission required” as the identity of the module |

Reduced motion: replace staged animation with labelled text updates on the same button.

---

## Explicit non-goals

- Per-post glass shimmer
- Gradient loaders as personality
- Drawer springs slower than `spring.standard` “because spatial”
- Animating teal fills across tabs
