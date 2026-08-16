---
name: phase7m
description: >-
  Binding Modula Phase 7M UI skill. Use before writing or migrating any visual
  component, screen chrome, Surface Type, icon, sheet, drawer, motion, or
  @expo/ui usage. Prevents a second design system.
---

# Modula UI Implementation Skill

The previous Phase 7M-B / 7M-B2 visual direction has been explicitly rejected. Preserve engineering only. 7M-B4 A/B/C are research, not an approved skin. **7M-B6** matures Direction M (editorial Product Hub, reachable install, sheets/drawers, Vault Notes 1.1 candidate). 7M-C and production deploy remain blocked. Founder visual approval is still required.

## Mission

Implement or migrate Modula UI without inventing new visual architecture.

**The Phase 7M UI System Research and Agent Skill Pack is the reference baseline for this mission. Do not blindly implement every proposed dependency or API. First inspect Modula's currently installed Expo SDK, React Native, Expo Router, `@expo/ui`, Reanimated, Gesture Handler, existing Surface runtime, existing platform adapters and shared components. Validate every external API against the exact installed version. Preserve existing accepted functionality. Consolidate existing components rather than creating parallel implementations. No broad product-screen redesign is authorised during 7M-A.**

Phase 7M-B2 screenshots are engineering evidence. They are not an approved design language. 7M-B4 compositions are selection studies. 7M-B5 implements Direction M’s flagged candidate only. 7M-C is blocked until founder visual approval.

## Anti-AI-UI rules (automatic failure)

- NO CARD SOUP
- NO PILL SOUP
- NO RANDOM GRADIENTS
- NO EVERYTHING-IS-ROUNDED
- NO GIANT EMPTY HERO SPACE WITHOUT PURPOSE
- NO GENERIC "WELCOME BACK" DASHBOARD DESIGN
- NO ICON-IN-PASTEL-SQUARE FOR EVERY ENTITY
- NO TEAL ON EVERY INTERACTION
- NO DUPLICATED TITLE + HEADER TITLE
- NO ADMIN/REGISTRY METADATA IN PRIMARY UI
- NO DEBUG LANGUAGE
- NO MOCK MARKETPLACE VISUALS
- NO GLASS SIMPLY BECAUSE GLASS EXISTS
- NO ANIMATION SIMPLY BECAUSE REANIMATED EXISTS
- NO INVENTED DESIGN WITHOUT A REFERENCE OR DOCUMENTED RATIONALE
- NO WHOLE-APP ROLLOUT BEFORE FOUNDER VISUAL APPROVAL

`#369CAA` is the Modula accent. It is not every button, badge, tab, icon background, filter, link, module artwork, or status. Neutral hierarchy does most of the work.

A section does not automatically need a background. A post does not automatically need a card. A label does not automatically need a pill. A status does not automatically need a badge. A filter does not automatically need another rounded container.

## Phase gate

| Phase | Authorised | Forbidden |
| --- | --- | --- |
| 7M-A | Docs, inventory, this skill | New visual components, dep installs, screen redesign |
| 7M-B | UI Lab + Login + Home + Product Hub prototypes | Migrating the rest of the app |
| 7M-B4 | Real-app research, three directions, twelve compositions, founder gate | Implementing a direction before selection; polishing 7M-B2 visuals; production deploy; starting 7M-C |
| 7M-B5 | Direction M, twelve compositions in one language, real-app + RN implementation study, flagged four-screen rebuild, Vault Notes available/install/open, UI Lab quality compare | Implementing all 12; Expo SDK upgrade; new UI framework; production deploy; starting 7M-C |
| 7M-B6 | Direction M Product Hub reconstruction, reachable install footer, search morph, generic host polish | Production deploy; starting 7M-C; Apple clone; second sheet primitive |
| 7M-C | Full rollout after **human visual approval** | Behaviour changes under the redesign |

If 7L-B is not closed (`P0 OPEN 0`, live identity agreed), stop. Do not start UI reconstruction on a broken beta.

## Mandatory preparation

1. Read:
   - `docs/research/phase7m-current-inventory.md`
   - `docs/design/modula-visual-constitution.md`
   - `docs/design/modula-component-contracts.md`
   - `docs/design/modula-motion-system.md`
   - `docs/design/modula-surface-system.md`
   - `docs/research/phase7m-reference-library.md`
   - `docs/research/phase7m-expo-ui-map.md`
2. Inspect `package.json` and installed `node_modules` versions.
3. Record Expo SDK, RN, React, RN Web, `@expo/ui`, expo-router, Reanimated, Gesture Handler.
4. Do not upgrade those packages unless the mission explicitly authorises it.
5. Search `src/platform/ui`, `src/components/primitives`, `src/theme`, and `src/platform/ui/dev/expo-ui-lab` before adding anything.
6. Follow `modula-dependencies` and `modula-architecture`. No Bluesky fork.

## BEFORE WRITING A NEW VISUAL COMPONENT

1. Search Modula for an existing equivalent.
2. Identify the semantic requirement.
3. Identify at least one approved reference.
4. Record the reference/source (repo, file, installed version or inspected SHA, licence).
5. Check installed Expo/RN compatibility against the **exact** installed version.
6. Decide: `NATIVE` | `EXISTING MODULA` | `ADAPT` | `CUSTOM`.
7. Define accessibility.
8. Define all Surface Type behaviour.
9. Define Reduce Motion behaviour.
10. Build it in UI Lab.
11. Visually verify it.
12. Only then use it in a production screen.

Skip 10–12 only in 7M-A, which must not write the component at all.

## Source policy (prefer in order)

1. Installed Expo SDK APIs (`@expo/ui` 57.0.10 as of inventory).
2. React Native core.
3. Existing Modula primitives / adapters.
4. Mature compatible library **behind a Modula adapter** after dependency admission.
5. Custom implementation.

Never import a third-party UI library from a product screen.

## Hard prohibitions

- Introduce another theme context or `packages/ui` beside the existing owners.
- Inline arbitrary animation timings.
- Add a new icon font.
- Use hardcoded SF Symbol names in features.
- Place raw `BlurView` / GlassEffect throughout screens.
- Create duplicate Sheet / Drawer / SegmentedControl primitives.
- Make a screen pass only by hiding a broken feature.
- Use mock product data in acceptance screenshots.
- Sacrifice accessibility for visual similarity.
- Install FlashList, TrueSheet, Gorhom, Radix, Moti, or Paper during 7M-A.
- Redesign working flows so they stop saving or restoring session.

## Companion files

- `docs/agent-skills/phase7m/reference-policy.md`
- `docs/agent-skills/phase7m/component-implementation.md`
- `docs/agent-skills/phase7m/screen-composition.md`
- `docs/agent-skills/phase7m/accessibility.md`
- `docs/agent-skills/phase7m/visual-verification.md`
- `docs/research/phase7m-b4-real-app-reference-matrix.md`
- `docs/research/phase7m-b5-social-reference-study.md`
- `docs/research/phase7m-b5-expo-ui-integration-map.md`
- `docs/research/phase7m-b5-liquid-glass-policy.md`
- `docs/design/phase7m-b5-direction-m.md`
- `docs/design/phase7m-b5-compositions.md`
- `docs/design/phase7m-b5-module-artwork.md`
