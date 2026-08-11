# Phase 7J — UI screen matrix (Mac-A)

Date: 2026-08-11  
Branch: `phase7j-product-convergence`  
API: `https://api.modula.digital` (production Greenfield @ `7632e03` image)

Statuses: `PASS` | `PASS_PRIOR` | `PARTIAL` | `REMAINING` | `N/A`

| Screen / surface | Build | Auth data | Icons | Images | Native feel | a11y/Reduce Motion | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| Sign in | PASS | PASS (API) | PASS_PRIOR | N/A | PARTIAL | PARTIAL | PARTIAL | OTP+password wired; visual polish remaining |
| Register / verify | PASS | PASS (API) | PASS_PRIOR | N/A | PARTIAL | PARTIAL | PARTIAL | Progressive redesign remaining |
| Home feed | PASS | PASS_PRIOR | PASS_PRIOR | PASS_PRIOR | PARTIAL | PASS_PRIOR | PARTIAL | Sticky modes + blur present |
| Stories rail | PASS | PASS_PRIOR | PASS_PRIOR | PASS_PRIOR | PARTIAL | PASS_PRIOR | PASS_PRIOR | Real create→rail proven earlier |
| Drawer | PASS | PASS_PRIOR | PASS_PRIOR | N/A | PARTIAL | PASS_PRIOR | PASS_PRIOR | MotionTokens springs |
| Floating tab bar | PASS | N/A | PASS_PRIOR | N/A | PARTIAL | PASS_PRIOR | PARTIAL | Refine remaining |
| Post card / reactions | PASS | PASS_PRIOR | PASS_PRIOR | PASS_PRIOR | PARTIAL | PARTIAL | PASS_PRIOR | Taxonomy locked |
| Comments | PASS | PASS_PRIOR | PASS_PRIOR | N/A | PARTIAL | PARTIAL | PASS_PRIOR | Nested replies wired |
| Profile `/profile` | PASS | PASS_PRIOR | PASS_PRIOR | PASS_PRIOR | PARTIAL | PARTIAL | PASS_PRIOR | Canonical; no Identity Centre |
| Settings / security | PASS | PASS_PRIOR | PASS_PRIOR | N/A | PARTIAL | PARTIAL | PARTIAL | Native feel polish remaining |
| Appearance / Surface Types | PASS | PASS_PRIOR | PASS_PRIOR | N/A | PARTIAL | PASS_PRIOR | PASS_PRIOR | OLED path preserved |
| Product Hub | PASS | PASS_PRIOR | PASS_PRIOR | PASS_PRIOR | PARTIAL | PARTIAL | PASS_PRIOR | Vault Notes honesty |
| Vault Notes host | PASS | PASS_PRIOR | PASS_PRIOR | N/A | PARTIAL | PARTIAL | PASS_PRIOR | External module |
| Discover / Activity / Search | PASS | PASS_PRIOR | PASS_PRIOR | PASS_PRIOR | PARTIAL | PARTIAL | PARTIAL | Visual rebuild remaining |
| Composer | PASS | PASS_PRIOR | PASS_PRIOR | PASS_PRIOR | PARTIAL | PARTIAL | PARTIAL | |
| Expo UI Lab | PASS | N/A | N/A | N/A | PASS | N/A | PASS | Developer only |

## Mac-A session gates

| Gate | Result |
|---|---|
| Source convergence + branch audit | PASS |
| Lint / typecheck / web build | PASS |
| Expo doctor 19/20 (CNG advisory) | PASS |
| iOS xcodebuild iPhone 17 Pro | PASS (`BUILD SUCCEEDED`) |
| Public API health/version | PASS |
| Auth verify/login/refresh/logout/re-login | PASS (API evidence) |
| Full Simulator UI golden-path screenshots (Parts 65–68) | REMAINING |
| Progressive native UI redesign (Parts 22–64 visuals) | REMAINING / PARTIAL |

## Evidence

- `docs/validation/evidence/phase7j-mac-ui/`
- Prior: `docs/validation/evidence/phase7i-mac-b-authenticated/`, `docs/validation/evidence/phase7j-session-restore/`
