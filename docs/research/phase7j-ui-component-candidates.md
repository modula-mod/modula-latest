# Phase 7J — UI component candidates

Date: 2026-08-11  
Policy: dependency admission + licence + SDK 57 / New Architecture. Prefer adapt-into-Modula over blind import.

| Candidate | Licence | Compat (SDK 57) | Decision | Rationale |
|---|---|---|---|---|
| Existing `@expo/ui` adapters | MIT (Expo) | Installed ~57.0.10 | **USE** | Canonical native control path |
| `expo-blur` / progressive blur custom | MIT | Installed | **USE** | `ProgressiveBlurBand` already shipped |
| `@callstack/liquid-glass` | check package | Installed ^0.8.0 | **ADAPT** | Tab/chrome only via adapters; no opaque slab |
| `expo-glass-effect` | MIT | Installed | **ADAPT** | Surface Type glass experiments via theme |
| Expo UI Lab patterns | MIT | In-tree | **USE** | Prove before global adoption |
| `expo-motion-tabs` (community) | varies | Unknown | **INSPIRE_ONLY** | Prefer `ModulaMotionTabs` already in tree |
| Liquid Glass Navbar samples | varies | Unknown | **INSPIRE_ONLY** | Adapt into `ModulaLiquidGlassTabBar` |
| Jakubantalik / transitions.dev | verify before copy | N/A | **INSPIRE_ONLY** | Study motion; adapt into `MotionTokens` — do not import blindly |
| thinking-orbs demos | varies | N/A | **REJECT** (default) | Optional only if it improves an existing AI surface |
| Tamagui / NativeWind | — | — | **REJECT** | Forbidden without phase approval |
| Direct SwiftUI imports in features | — | — | **REJECT** | Adapter-only rule |
| Bluesky ALF / `@bsky.app/*` UI | — | — | **REJECT** | Reimplement density only |

## Admission checklist (any new package)

1. Product use case written  
2. SDK-aligned install (`expo install` when Expo module)  
3. Licence reviewed  
4. Row in `docs/architecture/dependency-register.md`  
5. UI Lab proof before global use  
