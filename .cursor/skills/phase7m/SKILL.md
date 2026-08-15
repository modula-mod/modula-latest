---
name: phase7m
description: >-
  Binding Phase 7M UI skill. Use before any new visual component, screen
  chrome, Surface Type, icon, sheet, drawer, motion, or @expo/ui usage.
---

# Phase 7M (Cursor)

Follow `docs/agent-skills/phase7m/SKILL.md` in full.

**Reference baseline, not an implement-everything list.** Inspect installed Expo 57 / RN 0.86.2 / `@expo/ui` 57.0.10 / existing `src/platform/ui` + `src/theme` first. Consolidate. No `packages/ui` fork. No 7M-A production-screen redesign.

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
- `docs/design/modula-visual-constitution.md`
- `docs/design/modula-component-contracts.md`
- `docs/agent-skills/phase7m/`
