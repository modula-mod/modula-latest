# Phase 7H External UI Candidates

Date: 2026-08-08
Pinned Modula stack: Expo SDK `57.0.0`, `expo@57.0.8`, `@expo/ui@57.0.7`, React Native `0.86.0`, Reanimated `4.5.0`, Gesture Handler `2.32.0`, Skia `2.6.2`.

Policy: no source is copied unless provenance is recorded and license classification is acceptable. Public GitHub repositories are not assumed permissive.

Classification values:

- `VERIFIED_PERMISSIVE`
- `DECLARED_PERMISSIVE_REQUIRES_OVERRIDE`
- `NO_PERMISSION_INSPIRATION_ONLY`
- `INCOMPATIBLE`
- `REJECTED`

## Candidates

| Repository | Commit inspected | What it demonstrates | Potential Modula use | Expo/RN compatibility | Native dependencies | Performance considerations | Accessibility | Licence evidence | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `https://github.com/expo/examples` | `0073f46826addae3904f5ac2385a1340ab47f2c1` | Official Expo integration patterns and example app structure. | Highest-trust API integration reference for Expo modules and routing examples. | Official Expo examples; use examples matching SDK 57 where available. | Varies by example. | Treat examples as integration reference, not product UI source. | Varies by example. | GitHub license API returns root `LICENSE`, SPDX `MIT`, copyright `2026-present 650 Industries, Inc. (aka Expo)`. | `VERIFIED_PERMISSIVE`; reference only unless code is intentionally attributed. |
| `https://github.com/expo/expo` SDK 57 branch | `10eda55770828d9fd5d725dc543c99eeed443cef` (`sdk-57`); main also observed at `351899c9dc1e7ad1193ec5314d6349b7f391f463` | Official `@expo/ui` implementation, docs, package exports, and changelogs. | Source of truth for Expo UI behavior, `Host`, universal controls, community drop-ins, SwiftUI/Compose limits. | Modula uses SDK 57 but patch drift exists: installed `@expo/ui@57.0.7`, Doctor expects `~57.0.9`. | Expo UI native modules, SwiftUI, Jetpack Compose. | Universal `List` is not appropriate for large feeds; use for settings/forms. Host scopes must be bounded. | Native controls improve platform semantics when labels and state are provided. | GitHub license API returns root `LICENSE`, SPDX `MIT`, copyright `2015-present 650 Industries, Inc. (aka Expo)`. | `VERIFIED_PERMISSIVE`; use official APIs through adapters. |
| `https://github.com/Jakubantalik/transitions.dev` | `06f81950a67c1a89bd418be91f8a26ebca6472a9` | Notification badge, text state swap, menu dropdown, modal transition, panel reveal, page transition, icon swap, success confirmation, error shake, avatar interactions. | Interaction inspiration for counters, unread badge, saving/saved, bookmark/reaction icon swap, error shake. | Web/CSS transition showcase, not RN/Expo code. | None for direct web; not applicable to native RN. | Patterns need independent Reanimated implementation with reduced motion gates. | No RN accessibility semantics to reuse. | GitHub license API for root license returns 404. Root `package.json` is private and has no license field. | `NO_PERMISSION_INSPIRATION_ONLY`; do not copy snippets. |
| `https://github.com/Jakubantalik/thinking-orbs` | `e94f207ea122f8cca0aaa6409ab7fe82d55c38f1` | Canvas AI/agent loading states such as working, searching, solving, listening, connecting, weaving, composing, breathing, shaping. | Visual language reference for Gaia/AI executing/searching/composing states only. | React/web package; peers `react >=18`, `react-dom >=18`; not native RN. | Browser canvas. | Good for web canvas, but not appropriate as-is for native Expo app. | README advertises stateful indicators; native semantics would need wrapper. | GitHub license API returns root `LICENSE`, SPDX `MIT`; npm `thinking-orbs@0.2.0` license `MIT`. | `VERIFIED_PERMISSIVE` for reference; do not adopt in native app because Expo-native port fits stack better. |
| `https://github.com/mahdidavoodi7/expo-thinking-orbs` | `8fe844eb72f48407568b6a13d68d121e528f3072` | Expo/RN port of thinking-orbs using Skia and Reanimated with UI-thread rendering. | Candidate for restrained AI cognition/execution status: Gaia working/searching/composing/tool execution. | npm `expo-thinking-orbs@0.2.0`; peers match or allow Modula: Skia `>=2.0.0`, React `>=19`, RN `>=0.79`, Reanimated `>=4.0.0`, Worklets `>=0.7.0`. Dev deps exactly match Modula-level RN `0.86.0`, Reanimated `4.5.0`, Worklets `0.10.0`, Skia `2.6.2`. | `@shopify/react-native-skia`, `react-native-reanimated`, `react-native-worklets`. | Multiple Skia canvases can be costly; use only for AI execution surfaces, preferably shared clock/canvas strategy if exposed. | Package metadata claims reduced-motion support in repository materials; verify in source before adoption. | GitHub license API returns root `LICENSE`, SPDX `MIT`, with original and port copyrights; npm license `MIT`. | `VERIFIED_PERMISSIVE`; candidate for later restrained adoption after verifier coverage. |
| `https://github.com/SimformSolutionsPvtLtd/react-native-reactions` | `40ee9d5908a1086cc96d05cc239444b5d0011521` | Animated reaction picker architecture using Gesture Handler and Reanimated. | Study long-press/drag reaction picker behavior. | npm `react-native-reactions@1.0.0`; peers pin Gesture Handler `2.16.2` and Reanimated `3.8.1`, older than Modula (`2.32.0`, `4.5.0`). | Gesture Handler, Reanimated. | Animation ideas are relevant; direct package adoption may carry old peer assumptions. | Needs explicit accessible alternate path; not enough for Modula by itself. | GitHub license API returns root `LICENSE`, SPDX `MIT`; npm license `MIT`. | `VERIFIED_PERMISSIVE` for study; prefer internal `ModulaReactionPicker` instead of dependency. |
| `https://github.com/callstack/liquid-glass` | `78ec2470fb77627a033bcdc3c55190d0547b4166` | Native iOS 26 liquid glass views for RN. | Small chrome surfaces only: floating toolbar, tab chrome, compact overlays/media controls if runtime supports it. | npm `@callstack/liquid-glass@0.8.0`; peers `react`, `react-native`. README/docs require React Native `0.80+`, Xcode `>=26`, not supported in Expo Go. Modula has RN `0.86.0` but native Xcode gate is Mac-only. | Native iOS/Fabric view, Xcode 26; iOS-focused. | Use sparingly. Do not apply to content cards/settings rows/feed. | Must provide non-glass fallback for unsupported devices/reduce transparency. | GitHub license API returns root `LICENSE`, SPDX `MIT`; npm license `MIT`. | `VERIFIED_PERMISSIVE`; already dependency in `package.json`, but adoption remains chrome-only and iOS-gated. |
| `https://github.com/OmarShayya/Liquid-Glass-Navbar-React-Native-Expo` (`expo-liquid-glass-tabs`) | `c2582191c98d2ea92427d997cda906153f779b26` | Expo-focused liquid glass tab/navbar behavior, native iOS bar plus custom Android bar. | Evaluate against Modula existing bottom navigation; possible inspiration for tab chrome only. | npm latest is `expo-liquid-glass-tabs@0.3.0`; GitHub `main` package says `0.4.0` unreleased. Peers include Expo Router, Expo Blur, Expo Glass Effect, Haptics, Linear Gradient, GH `>=2`, Reanimated `>=4`, Worklets. | Expo Glass Effect, Blur, Haptics, Linear Gradient, Masked View, Gesture Handler, Reanimated, Worklets. | Navigation replacement risk is high; existing Modula shell already has custom liquid glass/progressive blur. | Must preserve tab labels, focus order, hit targets, reduced transparency. | GitHub license API returns root `LICENSE`, SPDX `MIT`; npm license `MIT` for `0.3.0`. | `VERIFIED_PERMISSIVE` but `REJECTED` for Phase 7H shell replacement; reference only unless evidence shows reliability improvement. |
| `https://github.com/rit3zh/expo-progressive-blur` | `f1f32e86b8fc33ca05b29af3b4ad5a7391f4e9d0` | Masked progressive blur header using MaskedView, Expo Blur, Linear Gradient, Reanimated. | Visual reference for compact headers/chrome; existing Modula has progressive blur header components. | Repo package targets Expo `~54.0.12`, RN `0.81.4`, Reanimated `~4.1.1`, not pinned Modula SDK 57. | Masked View, Expo Blur, Linear Gradient, Reanimated, easing gradient. | Blur overdraw risk; not for feed cards/settings rows. | Needs reduced transparency fallback. | GitHub license API returns 404 for root license; root package has no license field in inspected output. | `NO_PERMISSION_INSPIRATION_ONLY`; do not copy source. |
| `https://github.com/rit3zh/expo-motion-tabs` | `9a95ea9fa9839c6627bf15860797a208663369b4` | Animated bottom tab bar with morphing popup panel for Expo Router. | Interaction reference for tab motion constraints; not a shell replacement. | Repo package targets Expo `~55.0.24`, RN `0.83.6`, Reanimated `4.2.1`, Worklets `0.7.4`, older than Modula SDK 57. | Expo Blur, Glass Effect, Haptics, Gesture Handler, Reanimated, Worklets, SVG. | Morphing panels can add render and navigation complexity. | Needs focus/label/popup semantics; Android preview TODO in README. | GitHub license API returns 404 for root license; root package has no license field in inspected output. | `NO_PERMISSION_INSPIRATION_ONLY`; do not copy source. |
| `https://github.com/software-mansion-labs/skills` | `bc37ee5eff31c6dd81846f38b49c7b72ea37b281` | Current Software Mansion AI-agent guidance for React Native best practices: animations, gestures, Skia/canvas, Reanimated 4, rich text, multithreading, audio, JSI. | Planning reference for internal Reanimated/Gesture Handler reaction picker, story gestures, motion tokens, rich text/mentions. | Guidance repository, not a runtime dependency. | None unless a referenced pattern requires one. | Use to guide UI-thread gestures/animations and reduced motion; do not import code. | Good reference for reduced motion and gesture semantics; still must implement Modula labels and accessible alternatives. | GitHub license API returns 404 for root license in this checkout. README does not expose a root license in inspected output. | `NO_PERMISSION_INSPIRATION_ONLY`; cite concepts only, do not copy code. |

## Interaction Concepts To Adapt Independently

| Source | Concept | Modula target | Implementation rule |
| --- | --- | --- | --- |
| transitions.dev | Notification badge transition | Activity unread count | Reanimated implementation using Modula motion tokens; no copied CSS/code. |
| transitions.dev | Text state swap | Saving -> Saved, Follow -> Following | Independent opacity/translate transition; reduced motion instant. |
| transitions.dev | Menu dropdown / modal / panel reveal | Non-native fallback menus and sheets | Prefer Expo/native sheet/menu first; animate only fallback. |
| transitions.dev | Icon swap | Bookmark and reaction state | Use Reanimated icon transition; accessible state labels. |
| transitions.dev | Success confirmation | Post created / export complete | Subtle confirmation; no confetti. |
| transitions.dev | Error shake | rejected auth/form input | Only for actionable form errors; reduced motion disables shake. |
| thinking-orbs / expo-thinking-orbs | AI working/searching/composing | Gaia/AI execution status | Restrained use only; ordinary loading stays progress/skeleton. |
| react-native-reactions | Long-press/drag reaction picker | `ModulaReactionPicker` | Internal implementation with four stable reaction IDs and accessible menu alternative. |
| Callstack Liquid Glass | Native glass chrome | small iOS 26 overlays/chrome | Use existing native glass first; fallback by runtime support/reduce transparency. |
| expo-liquid-glass-tabs | Liquid glass tab behavior | bottom nav reference | No shell replacement in Phase 7H without proof. |
| expo-progressive-blur | Masked blur header | compact chrome reference | Inspiration-only; existing Modula blur discipline applies. |
| expo-motion-tabs | Motion tab interactions | product tab reference | Inspiration-only; avoid extra navigation complexity. |

## Adoption Gate

Before any third-party component is adopted into source:

1. Record repository URL and exact commit.
2. Record root license evidence, package metadata, README declaration, npm metadata, or official maintainer statement.
3. Record peer dependencies against Modula's pinned Expo/RN/Reanimated/Skia/Worklets versions.
4. Add attribution if required by license.
5. Add verifier coverage in `verify-phase7h-third-party-provenance.mjs`.

Current adoption decisions:

- Adopt no new third-party source during Checkpoint A.
- Prefer internal Modula Reanimated/Gesture Handler components for reaction picker and counters.
- Consider `expo-thinking-orbs` later only for AI execution states after performance and reduced-motion proof.
