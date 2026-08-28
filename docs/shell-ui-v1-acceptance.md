# Shell UI V1 — Acceptance matrix

**Branch:** `cursor/shell-ui-v1-reconstruction`  
**Start `origin/main`:** `a0d4d7966f4a3ae8f12736d1bb8dff169a3d0227`  
**Device:** iPhone 17 Pro Simulator (when visual pass runs)

Legend: PASS / FAIL / NOT_RUN. NOT_RUN is never counted as PASS.

| Route | iOS render | iOS interaction | Light | Dark | OLED | Reduce Motion | Dynamic Type | Web mobile | Web desktop | Loading | Empty | Error | Real data | Known limitation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home `/` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS source | PASS source | PASS source | PASS source | OLED now uses canvas; visual pending |
| Profile `/profile` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS source | PASS source | PASS source | PASS source | Fake Interests copy removed |
| Discover `/discover` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS source | PASS source | PASS source | PASS source | Wider scroll segments |
| Activity `/activity` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS source | PASS source | PASS source | PASS source | Decorative mute/remove removed; no dedicated Notifications tab |
| Notifications `/settings/notifications` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | N/A prefs | N/A | N/A | PASS source | Distinct from Activity stream |
| Composer `/compose` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS source | PASS source | PASS source | PASS source | Tools from current contribution model |
| Settings `/settings` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | N/A | PASS source | N/A | PASS source | Canonical search field; env string not on home |
| Appearance `/settings/appearance` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | N/A | N/A | N/A | PASS source | Existing theme runtime |
| Accessibility `/settings/accessibility` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | N/A | N/A | N/A | PASS source | Binds textScale / reduceMotion / contrast |
| Product Hub `/product` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS source | PASS source | PASS source | PASS source | Catalogue adapter; keepPreviousData |
| Module Detail `/marketplace/[id]` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS source | PASS source | PASS source | PASS source | Readable rails; honest screenshot empty |
| Module Host `/module/[id]` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PASS source | PASS source | PASS source | PASS source | Chrome/loading copy only |
| Auth `/welcome` `/sign-in` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | N/A | N/A | PASS source | PASS source | Presentation only |
| Onboarding `/onboarding` | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | N/A | N/A | N/A | PASS source | Pre-account tour only |

## Source gates

| Check | Status |
| --- | --- |
| `pnpm verify:shell-ui-v1` | PASS |
| Lint | pending |
| Typecheck | pending |
| Web build | pending |
| iOS build | pending |
| Android build | pending |
| Fresh checkout | pending |

## P0 / P1 (source review, visual pending)

| | Count |
| --- | --- |
| P0 | 0 known |
| P1 | 0 known at source; visual confirmation required |
