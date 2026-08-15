---
name: phase7m
description: >-
  Binding Phase 7M UI skill. Use before any new visual component, screen
  chrome, Surface Type, icon, sheet, drawer, motion, or @expo/ui usage.
---

# Phase 7M (Cursor)

The previous Phase 7M-B visual direction has been explicitly rejected by the founder. Do not polish, preserve, or treat its visual composition as the baseline. Preserve its engineering work only. Research real shipping applications first, derive three materially different Modula visual directions, and stop for founder selection before broad implementation.

Follow `docs/agent-skills/phase7m/SKILL.md` in full.

**Reference baseline, not an implement-everything list.** Inspect installed Expo 57 / RN 0.86.2 / `@expo/ui` 57.0.10 / existing `src/platform/ui` + `src/theme` first. Consolidate. No `packages/ui` fork. No 7M-A production-screen redesign.

7M-B2 screenshots are engineering evidence only. 7M-B4 compositions live in the evidence archive under `phase-7m/b4/`. Do not start 7M-C or a four-screen prototype until founder selection.

## Anti-AI-UI rules

NO CARD SOUP · NO PILL SOUP · NO RANDOM GRADIENTS · NO EVERYTHING-IS-ROUNDED · NO GIANT EMPTY HERO SPACE WITHOUT PURPOSE · NO GENERIC "WELCOME BACK" DASHBOARD DESIGN · NO ICON-IN-PASTEL-SQUARE FOR EVERY ENTITY · NO TEAL ON EVERY INTERACTION · NO DUPLICATED TITLE + HEADER TITLE · NO ADMIN/REGISTRY METADATA IN PRIMARY UI · NO DEBUG LANGUAGE · NO MOCK MARKETPLACE VISUALS · NO GLASS SIMPLY BECAUSE GLASS EXISTS · NO ANIMATION SIMPLY BECAUSE REANIMATED EXISTS · NO INVENTED DESIGN WITHOUT A REFERENCE OR DOCUMENTED RATIONALE · NO WHOLE-APP ROLLOUT BEFORE FOUNDER VISUAL APPROVAL

## BEFORE WRITING A NEW VISUAL COMPONENT

1. Search Modula for an existing equivalent.
2. Identify the semantic requirement.
3. Identify at least one approved reference.
4. Record the reference/source.
5. Check installed Expo/RN compatibility.
6. Decide: `NATIVE` | `EXISTING MODULA` | `ADAPT` | `CUSTOM`.
7. Define accessibility.
8. Define all Surface Type behaviour.
9. Define Reduce Motion behaviour.
10. Build it in UI Lab.
11. Visually verify it.
12. Only then use it in a production screen.

## Pointers

- `docs/research/phase7m-current-inventory.md`
- `docs/research/phase7m-b4-real-app-reference-matrix.md`
- `docs/design/modula-visual-constitution.md`
- `docs/design/modula-component-contracts.md`
- `docs/design/phase7m-b4-visual-directions.md`
- `docs/agent-skills/phase7m/`
