# PVP-UI-1 Expo UI Examples provenance

Third-party reference source policy. No provenance record = no copied implementation.

## Repository

| Field | Value |
| --- | --- |
| Upstream | https://github.com/SchroederNathan/expo-ui-examples |
| Inspected checkout | `/Users/msjoy/.cursor/agents/expo-ui-examples` |
| Inspected SHA | `5d45a09c587d8e9841f8b359236a077970cb26d4` |
| Inspected commit | `5d45a09 Merge pull request #6 from SchroederNathan/rich-text-editor` |
| Licence | MIT (file `LICENSE`, Copyright 2015-present 650 Industries, Inc. / Expo) |
| Target | Expo SDK 57 examples using `@expo/ui` |

The local checkout remotes `upstream` to SchroederNathan and `origin` to `modula-mod/expo-ui-examples`. Inspection used the SHA above, not an unpublished fork diff.

## Files inspected

| Example | Path | What we learned | Copied into Modula? |
| --- | --- | --- | --- |
| Liquid Glass | `src/examples/liquid-glass/glass-playground.tsx` | `Host` wraps SwiftUI. `GlassEffectContainer` morphs grouped glass. `glassEffect` / `glassEffectId` modifiers. Interactive glass is for controls, not page backgrounds. | NO wholesale paste. Chrome uses existing `LiquidGlassChrome` adapter over installed `expo-glass-effect` 57.0.1. |
| Animated Symbols | `src/examples/animated-symbols/animated-symbols.tsx` | SF Symbol `symbolEffect` is confirmation, not decoration. | NO. Install confirmation may later use Modula icon adapters; not every Product Hub icon animates. |
| Music Player / BottomSheet | `src/examples/music-player/now-playing-sheet.tsx` | Detent sheet + morph. | NO. Product Hub keeps existing Modula sheet. No Gorhom / TrueSheet. |
| Universal Settings | `src/examples/universal-settings/universal-settings.tsx` | Universal `@expo/ui` root renders SwiftUI Form / Material list from one tree. | NO settings redesign this phase. Pattern supports later Shell/Settings. |
| Material You | `src/examples/material-you/material-you.tsx` | `useMaterialColors` / wallpaper seeds. JS hook does not subscribe to system changes. | NO. Modula Appearance remains the accent owner. Wallpaper must not override `#369CAA` unless the user chose a Material-following surface. |
| Expressive Loaders | `src/examples/expressive-loaders/expressive-loaders.tsx` | Compose `LoadingIndicator` morph for install. | NO. Product Hub uses existing install presentation + compact CTA. |

## What Modula changed relative to those examples

- Never import `@expo/ui/swift-ui` from Product Hub feature files.
- Liquid Glass is chrome-only (search trigger, compact header controls). Content background stays semantic canvas.
- Reduce Transparency / Reduce Motion force opaque raised surfaces and crossfades.
- Material You dynamic colour is not allowed to silently restyle Product Hub against Appearance.
- No music-player BottomSheet, Siri glow, or Swift Charts on Product Hub.

## Official Expo source priority

When community examples disagree with installed `node_modules/expo-router` or `@expo/ui` 57.0.12 types, the installed types win. The v55 blog is research, not the contract.
