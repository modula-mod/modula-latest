# Phase 4.5 Visual Defect Audit

Date: 2026-07-16  
Repository: `modula-latest` @ `d0e82e98b2aa6aa8ff4ad2158121a151714b4261`  
Branch: `phase4-5-native-ui-recovery`  
Evidence: `docs/validation/phase4-5-before/` (no intentional before-screenshot set was available locally at audit time)

---

## Reels screen

| ID | Defect | Severity |
|---|---|---|
| R1 | No meaningful media composition — flat colour field instead of image/video/editorial still | High |
| R2 | Accent/teal fills nearly the complete screen | High |
| R3 | Black text/controls have weak visual separation | High |
| R4 | Top navigation is custom and spatially disconnected | Medium |
| R5 | Action rail lacks contained 44–48pt targets | Medium |
| R6 | Caption sits too low and competes with the bottom edge | Medium |
| R7 | Floating developer gear must not overlay content | Medium |
| R8 | No native tab/toolbar relationship on immersive route | Medium |
| R9 | Excessive empty/flat space | High |
| R10 | Back control has no native navigation-bar container | Medium |

## Home

| ID | Defect | Severity |
|---|---|---|
| H1 | Custom bottom bar (`MainTabBar`) instead of system tab bar | High |
| H2 | Create embedded as a tab destination | High |
| H3 | Bottom bar too tall and visually heavy | Medium |
| H4 | Primary accent overused across chrome | Medium |
| H5 | Story rail, feed selector, composer and feed compete for attention | Medium |
| H6 | Floating developer gear must not overlay the first post | Medium |
| H7 | Header is a custom mock (`AppHeader`), not a native navigation bar | High |
| H8 | Post metadata uses excessive vertical space | Low |
| H9 | Engagement controls lack clear 44-point targets | Medium |
| H10 | Media placeholder visually unfinished | Medium |
| H11 | Too many separators and hard borders | Low |

## Profile

| ID | Defect | Severity |
|---|---|---|
| P1 | Cover lacks visual purpose and editing affordance | High |
| P2 | Avatar, Focus Halo and focus badge compete | Medium |
| P3 | Identity claims overload the hero | High |
| P4 | Biography starts too far right under avatar column influence | Medium |
| P5 | Four large action controls create an unbalanced block | High |
| P6 | Selected Modules tab is an oversized pill | High |
| P7 | Profile tabs do not fit naturally | Medium |
| P8 | Module content can begin behind the custom bottom bar | High |
| P9 | No native navigation toolbar | High |
| P10 | Floating gear overlaps content | Medium |
| P11 | Profile feels like a settings/identity panel instead of a social profile | High |

## Shell cross-cutting

| ID | Defect | Severity | Root cause notes |
|---|---|---|---|
| S1 | iPhone account panel uses custom animated drawer | High | `NavigationDrawer` + `ShellDrawerContext` |
| S2 | Instant open-then-close | Critical | Effect closes when `phase === 'open'`, so open completion immediately dismisses |
| S3 | Toggle-like panel API | Medium | Product triggers need explicit open/close |
| S4 | Board is not a primary tab; Create occupies a tab slot | High | Tab IA mismatch |
| S5 | Hardcoded custom-bar bottom padding assumptions | Medium | Must be removed with native tabs |

## Repair mapping

| Area | Phase 4.5 repair |
|---|---|
| Tabs | `NativeTabs` + five destinations; Create removed |
| Headers | Expo Router Stack headers/toolbars |
| Account panel | Adaptive sheet + reducer; fix instant-close root cause |
| Home | Native header → stories → selector → composer prompt → feed |
| Reels | Media + scrim + `mediaOverlay*` tokens |
| Profile | Hero simplification, cover/avatar editors, restrained tabs |
| Developer UI | Settings → Developer only |
| Contrast | Semantic media overlay tokens + automated checks |
| Verifier | `scripts/verify-phase4-5-native-ui.mjs` |
