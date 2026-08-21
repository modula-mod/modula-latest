# Phase 7N-A evidence manifest

PRODUCT REPOSITORY
modula-mod/modula-latest
SOURCE BRANCH
cursor/phase7n-a-mainline-ui-convergence-60f3
SOURCE SHA
c9383df42c9dabe5c2cee399ebf8bb6d61d13f70
EXPO SDK
57.0.15 (expo ~57.0.15, react-native 0.86.2, @expo/ui ~57.0.12)
IOS TARGET
iPhone 17 Pro Simulator (UDID 0727E2F0-8528-44DA-9F4C-7B5F7394096B)
WEB BUILD SHA
0752f92 (web export from the convergence SHA before later docs commits; not redeployed)
PRODUCTION
NOT DEPLOYED BY THIS PHASE
CAPTURE DATE
2026-08-21
CAPTURE ENVIRONMENT
fresh-main clone: NOT YET (origin/main still fcca100; this pack is from the 7N-A native worktree `/Users/msjoy/Developer/modula-7n-a-native` against Metro)
CANDIDATE VERSION
Vault Notes 1.1.0 (canonical `digital.modula.vault-notes`; local catalogue fallback)
PRODUCTION VERSION
VPS `/root/modula-latest` remains detached at e5d4b946 — distinct from this candidate; not modified
SCREENSHOT COUNT
50 valid named stills in the evidence repo `phase-7n/a/` (excluding contact sheets and quarantined stuck frames)
MOTION CLIP COUNT
0 (Reduce Motion / navigation video not captured; Mac console locked, XCTest/Maestro timed out)
CONTACT SHEETS
CORE-7, SOCIAL, MARKETPLACE, SYSTEM, APPEARANCE

## Capture method

Primary: iPhone 17 Pro Simulator + `simctl openurl` `modula:///<route>` + `simctl io screenshot`.
Demo owner: `EXPO_PUBLIC_DATA_SOURCE=local` `EXPO_PUBLIC_DEMO_SESSION=owner` after a clean install (SecureStore must be empty; in-memory local API resets on JS reload).
Mac display: `CGSSessionScreenIsLocked=Yes` — Apple Events `-1743`, cliclick unusable, Maestro `IOSDriverTimeoutException`. Deep links and screenshots still worked.

## Core 7 (light, native, iOS) — mandatory

| Route | File | Status |
| --- | --- | --- |
| PROFILE | `profile/7n-a-ios-profile-owner-light-native-top.png` | CAPTURED (owner Andrei; Posts tab) |
| MODULE DETAIL | `module-detail/7n-a-ios-module-vault-notes-light-native-top.png` | CAPTURED (Vault Notes 1.1.0) |
| PRODUCT HUB | `product-hub/7n-a-ios-product-hub-light-native-top.png` | CAPTURED (Vault Notes featured) |
| POST | `post/7n-a-ios-post-image-light-native-resting.png` | CAPTURED (`/post/post-showcase-bali`) |
| LOGIN | `auth/7n-a-ios-login-light-native.png` | CAPTURED (identity step) |
| REGISTER | `auth/7n-a-ios-register-light-native.png` | CAPTURED (identity step only) |
| ONBOARDING | `onboarding/7n-a-ios-onboarding-light-native.png` | CAPTURED (step 1 of 3, Welcome → Get started) |

## Honest gaps (do not fake)

| Requested state | Result |
| --- | --- |
| Profile mid/bottom scroll | NOT CAPTURED — no swipe while Mac locked |
| Product Hub search-active / results | NOT CAPTURED — search is local reducer state, no URL |
| Product Hub installed / updates | NOT IMPLEMENTED or empty in local catalogue (no installed modules) |
| Module tabs Features/Permissions/Reviews/Related | NOT CAPTURED — tab is component state, no URL |
| Module install progress | LOCAL INSTALL PREVIEW FAILED (`Vault Notes couldn't be prepared`) — isolated, not judged as visual |
| Post reaction picker / comments / share / context menu | NOT CAPTURED — requires tap |
| Post carousel / video / music | NOT IN LOCAL SEED as distinct surfaces |
| Login password / code / error | NOT CAPTURED — identity step only without typing |
| Register password / handle / terms | NOT CAPTURED — first step only |
| OLED / Dim as in-app modes | NOT DISTINCTLY CAPTURED — Appearance first viewport shows System / Light / Dark; OLED/Dim below fold unconfirmed |
| Surface Types on Hub/Profile/Post | NOT APPLIED — only Appearance settings + surface playground stills |
| Large Text Login/Profile | INVALID (stuck openurl) — quarantined; Module Detail large-text still exists |
| Reduce Motion video | NOT CAPTURED |
| Mobile/desktop web | NOT CAPTURED this pass |
| Fresh clone `/Users/msjoy/Developer/modula-main-ui-baseline` | NOT CREATED — origin/main not yet fast-forwarded |

Stuck `simctl openurl` frames (identical byte sizes after timeout) were moved to `phase-7n/a/_invalid-stuck/` and must not be used as route evidence.

## Media / icon gates (from inspected stills)

MISSING GLYPHS = 0 on Core-7 light stills (SF-style / app icons rendered).
BROKEN EXPECTED MEDIA = 0 on owner Profile cover, Jenny Wilson Bali post, Vault Notes cover.
Owner avatar is a letter glyph, not a photograph (seed, not a load failure).
Gaia public post media is a grey rectangle — treat as possible missing poster, not as Profile design.
