# Phase 7M-B5 — React Native animation samples audit

**Repo:** https://github.com/Aashu-Dubey/react-native-animation-samples  
**Licence:** MIT  
**Role:** behaviour source, **not** a design system.  
**Inspected:** 2026-08-15 (public README + sample list). Do not vendor the repo.

The project explicitly demonstrates **gesture-based interruptible** animations (Reanimated + Gesture Handler). That matches Modula’s installed stack (Reanimated 4.5.1, RNGH 2.32.0).

Do not copy rope physics into the product merely because it exists. Only adopt motion that communicates interaction.

---

## Sample audit

| Sample | What it demonstrates | Likely Modula application | Decision |
| --- | --- | --- | --- |
| Custom Toolbar | Interruptible toolbar that expands/collapses with gesture; tools remain targetable | Composer Tools, media toolbar, Profile customization, Story controls, Product Hub action cluster | REIMPLEMENT_BEHAVIOUR |
| Color Swatch | Selection that follows finger; colour as state | Appearance accent picker (settings, not feed) | INSPIRATION_ONLY for B5 flagships |
| Grid Magnification | Proximity-based scale; nearest cell enlarges, others recede | Reaction selection; emoji/reaction picker; Gubic launcher; avatar/appearance picker; module quick launcher | REIMPLEMENT_BEHAVIOUR for reactions |
| Rope Physics | Verlet/rope simulation | None in B5. Decorative. | REJECT for product |
| Custom Cursor/Caret | Caret/cursor as feedback during validation | Auth field feedback, password strength, composer, developer/editor surfaces | REIMPLEMENT_BEHAVIOUR lightly for auth (native caret + copy), not a custom Skia cursor on iOS |
| Cards Swap | Shared-element-like card reordering | Not a feed pattern; maybe Hub featured swap later | INSPIRATION_ONLY — do not put swap theatre on Home |

---

## Binding implementation notes

- Reimplement on Modula motion tokens (`src/theme` / `src/platform/ui/motion`). No copied timings from the sample app.
- Reduce Motion: skip proximity scale; use a static row or a platform menu.
- Web: Grid Magnification becomes a standard menu (`ModulaMenu` / listbox). Pointer users get hover; keyboard users get arrow keys.
- Haptics on selection (already `selectionHaptic` / `lightImpactHaptic`).
- Do not add Skia solely to port a sample.
