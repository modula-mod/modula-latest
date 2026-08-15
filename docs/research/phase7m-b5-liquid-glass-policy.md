# Phase 7M-B5 — iOS Liquid Glass policy

Do not repeat the 7M-B2 mistake where moving feed content was readable through the tab bar.

Liquid Glass is permitted only where it produces a **usable** result. Expo SDK 57 supports native iOS glass APIs (glass modifiers, glass button styles) with platform/version constraints and documented rendering caveats.

`expo-glass-effect` falls back to a regular View when unsupported. Design for that fallback first.

---

## GLASS_ALLOWED

Usable when the backdrop is controlled, the control is small, and fallback is opaque:

- Context menus
- small toolbar buttons (`buttonStyle('glass')`)
- transient sheets / sheet accessories
- floating controls where the sampled backdrop is a known still image or a dimmed overlay
- selected overlays (reaction picker backdrop, not the picker sitting on scrolling text)

## GLASS_OPTIONAL

Try in UI Lab; ship only if Reduce Motion, OLED, and fallback all pass:

- top navigation
- drawer controls
- composer accessory controls
- NAV-B/C chrome **if** fully opaque when glass is unavailable

## GLASS_FORBIDDEN unless visually proven (default: forbidden)

- bottom navigation over **moving feed text**
- large content cards
- feed cells
- module cards / Product Hub rows
- form backgrounds (auth fields, settings forms)
- Surface Type `glass` as a wallpaper behind Home

---

## Surface Type `glass`

Layout remains identical across `native | solid | glass | glay | minimalSpatial`.

Material expression may change. Hierarchy, hit targets, and contrast may not.

If a screen is unreadable without glass, the design is invalid.

---

## Web

Glass on web may use a controlled custom implementation (backdrop-filter with a solid fallback). Do not promise pixel-identical Liquid Glass. Objective: same design language, different platform implementation.
