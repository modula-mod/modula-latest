# Shell UI V1 — Acceptance matrix

**Branch:** `cursor/shell-ui-v1-reconstruction`  
**Start `origin/main`:** `a0d4d7966f4a3ae8f12736d1bb8dff169a3d0227`  
**Device:** iPhone 17 Pro Simulator (`1F8BD84E-2432-45A0-B93A-36D7D745860D`, iOS 26.3)

Legend: PASS / FAIL / NOT_RUN. NOT_RUN is never counted as PASS.

| Route | iOS render | iOS interaction | Light | Dark | OLED | Reduce Motion | Dynamic Type | Web mobile | Web desktop | Loading | Empty | Error | Real data | Known limitation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home `/` | PASS | NOT_RUN | PASS (sim light) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS | PASS | PASS | PASS | PASS source | PASS | Simulator “Open in Modula?” URL confirm blocked taps; host display locked at loginwindow |
| Profile `/profile` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS (not-found without session) | PASS | PASS source | PASS source | PASS source | PASS source | Fake Interests copy removed; Joined label |
| Discover `/discover` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS | PASS | PASS | PASS | PASS source | PASS | Search field labelled; Marketplace segment min width 112 |
| Activity `/activity` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS | PASS | PASS | PASS | PASS source | PASS | List rows, not cards; no dedicated Notifications tab |
| Notifications `/settings/notifications` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS source | PASS source | N/A prefs | N/A | N/A | PASS source | Distinct from Activity stream |
| Composer `/compose` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS | PASS | PASS source | PASS source | PASS source | PASS source | Tools from current contribution model; short availability copy |
| Settings `/settings` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS | PASS | N/A | PASS | N/A | PASS | Canonical search field; no env string; no unbound haptic toggle |
| Appearance `/settings/appearance` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS | PASS | N/A | N/A | N/A | PASS source | Existing theme runtime |
| Accessibility `/settings/accessibility` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS | PASS | N/A | N/A | N/A | PASS | Binds textScale / reduceMotion / contrast / transparency |
| Product Hub `/product` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS | PASS | PASS | PASS | PASS | PASS | Catalogue adapter; keepPreviousData; editorial Vault Notes hero |
| Module Detail `/marketplace/[id]` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS source | PASS source | PASS source | PASS source | PASS source | PASS source | Readable rails; honest screenshot empty |
| Module Host `/module/[id]` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS source | PASS source | PASS source | PASS source | PASS source | PASS source | Chrome/loading copy only |
| Auth `/welcome` `/sign-in` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS | PASS | N/A | N/A | PASS source | PASS source | Presentation only |
| Onboarding `/onboarding` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS | PASS | N/A | N/A | N/A | PASS source | Pre-account tour only |

## Source gates

| Check | Status |
| --- | --- |
| `pnpm verify:shell-ui-v1` | PASS |
| `pnpm verify:phase7m-b10` | PASS |
| Lint | PASS |
| Typecheck | See environment note |
| Web export (`EXPO_PUBLIC_DATA_SOURCE=local`) | PASS (178 routes) |
| Canonical `pnpm build:web` | pending this revision |
| iOS native build | PASS (prior `expo run:ios` on iPhone 17 Pro) |
| Android build | NOT_RUN — `ANDROID_HOME` unset, no emulator, no `adb` |
| Android visual | NOT_RUN — no emulator |
| Fresh checkout | pending |

## Typecheck environment note

`pnpm typecheck` on this Mac can fail in `@modula/module-standard` `file:` (2.0.0) vs Greenfield PVP extension types expected by `packages/greenfield-module-manifest`. That is MPS/workspace environment debt, not a shell presentation bypass. This mission does not change MPS.

## Evidence

- iOS Home (iPhone 17 Pro): `docs/validation/evidence/shell-ui-v1/ios-home-iphone17pro.png` — feed, chrome, Following, composer, Jenny Wilson Bali post. A Simulator “Open in Modula?” URL confirmation sits on top (not app UI).
- Web: `web-home.png`, `web-home-desktop.png`, `web-settings.png`, `web-product-hub.png`, `web-discover.png`, `web-activity.png`, `web-welcome.png`, `web-appearance.png`

## P0 / P1

| | Count |
| --- | --- |
| P0 | 0 |
| P1 (product) | 0 known |
| Environmental | iOS tap-through blocked by Simulator URL confirm + locked host display; Android SDK absent |

Do not treat NOT_RUN as PASS.
