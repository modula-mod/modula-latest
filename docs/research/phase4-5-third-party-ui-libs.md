# Phase 4.5 — Third-party UI library research

Evaluated 2026-07-16 against Expo SDK 57 / React Native 0.86. Primary tabs remain the authorized liquid-glass expandable bar. Reanimated/Worklets stay **adapter-only** for that bar unless a future decision explicitly widens scope.

## Decision summary

| Source | Decision | Why | Modula landing |
|---|---|---|---|
| [outpacelabs/avatars](https://github.com/outpacelabs/avatars) (`@outpacelabs/avatars`) | **Reject install** (for this use case) | Package is *generative mesh-gradient / dither canvas avatars for React DOM*, peer `react>=18` only. It does **not** provide stacked faces, presence rings, story rings, or group grids. RN/image pipeline mismatch for product avatars. MIT licence is fine; product fit is wrong. | Built Modula equivalents under `src/platform/ui/avatars/` |
| [Solarin-Johnson/my-app](https://github.com/Solarin-Johnson/my-app) | **Port ideas only** | Personal Expo playground (keyboard, Twitter profile, Threads refresh, Grok sidebar). Heavy Reanimated experiments; not a reusable library. Do not vendor the app. | Press opacity via `AppPressable`, profile underline motion via `ModulaMotionTabs` + `LayoutAnimation`, keyboard already in `platform/ui/keyboard/` |
| [rit3zh/expo-curved-bottom-tabs](https://github.com/rit3zh/expo-curved-bottom-tabs) | **Reject install** | Demo app (not npm). Stack: Expo 56 / RN 0.85 / **Reanimated 4** / Gesture Handler / **Skia** / expo-glass-effect. Would fight the primary liquid-glass tab bar if used globally. | `ModulaCurvedSectionTabs` for **Marketplace nested section chrome only** |
| [rit3zh/expo-motion-tabs](https://github.com/rit3zh/expo-motion-tabs) | **Reject install** | Demo bottom-tab bar with morphing *popup panels* (Expo 55 / RN 0.83 / **Reanimated 4**). Wrong surface for Profile Posts/Media/About content tabs; also Reanimated-heavy. | `ModulaMotionTabs` content-tab strip on Profile (LayoutAnimation, no new Reanimated product usage) |

## Extension points (for later)

- `src/platform/ui/avatars/` — add generative seeds, status animations, or a thin web-only `@outpacelabs/avatars` adapter if product wants mesh gradients on web.
- `src/platform/ui/tabs/modula-motion-tabs.tsx` — swap LayoutAnimation for Expo UI selection chrome later.
- `src/platform/ui/tabs/modula-curved-section-tabs.tsx` — deepen Skia curve only if Marketplace needs it and Skia is admitted.
- Do **not** wire curved/motion demos as a second global tab bar.

## Reanimated conflict note

Curved-tabs and motion-tabs demos **require Reanimated**. Modula already has Reanimated for the authorized liquid-glass tab adapter only; product features must not import it (`verify:phase4-5` check 35). Prefer the Modula ports above. If a future pass needs the upstream demos verbatim, document an explicit policy exception before expanding Reanimated beyond the tab adapter.

## Solarin patterns adopted (lightweight)

1. Subtle press scale/opacity — already on `AppPressable` via theme `motion.pressScale`.
2. Profile tab underline that animates selection width — `ModulaMotionTabs`.
3. Filter/list enter via `LayoutAnimation` on Activity / Home feed mode change (Reduce Motion respected).
