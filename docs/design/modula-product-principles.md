# Modula Product Principles

Status: Phase 7C design lock

## Native Where It Matters

Use native navigation, controls, menus, search, sheets, keyboard behavior, and accessibility behavior where the installed SDK and route architecture support them.

Native does not mean every surface must be platform-specific. Prefer Modula adapters with functional web and Android fallbacks.

## Modula Identity

Native does not mean visually generic. Modula keeps:

- Teal accent
- Focus Halo
- Board
- Module contributions
- Surface system
- Product Hub
- Social OS language

## One Level Of Emphasis

Do not place:

- glass card inside glass card
- glass card inside blurred sheet
- blurred sheet inside translucent background
- decorative effect behind another decorative effect

Use one material decision per surface. Content should stay readable when Reduce Transparency is enabled.

## Information First

UI hierarchy must come from content, state, and task order, not effects.

Use density for scanability:

- compact metrics
- clear post hierarchy
- grouped settings
- status pills
- stable toolbars
- predictable tab and drawer placement

## Motion Explains State

Animation may indicate:

- opening
- insertion
- completion
- navigation
- expansion
- installation progress
- optimistic update or rollback

Animation must not continuously decorate static screens. Reduced Motion must simplify transitions without hiding state changes.

## Accessible By Default

Every screen must function under:

- large text
- bold text
- reduced motion
- reduced transparency
- increased contrast
- screen readers
- keyboard navigation on web

Controls must have accessible names, state, and disabled/failure descriptions.

## Module-Native, Not Linked Out

Every module should feel installed into Modula. A module may be externally packaged, but its user-facing route, settings, Board card, tools, and lifecycle states must render through Modula host contracts.

## Honest Capability Copy

Do not imply:

- encryption unless implemented and verified
- offline publishing unless queued submission is implemented safely
- Gaia autonomy unless governed execution exists
- paid module support while DIMON is inactive
- public marketplace support before public submission/review exists

Use `Private in Modula` for Vault Notes.
