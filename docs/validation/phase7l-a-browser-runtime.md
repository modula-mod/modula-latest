# Phase 7L-A Browser Runtime Audit

Date: 2026-08-13
Tool: Playwright via local Chromium/Google Chrome
Viewport: mobile `390x844`
Evidence directory: `docs/validation/evidence/phase7l-a/browser-public/`

## Crawl summary

| Metric | Count | Status |
| --- | --- | --- |
| Routes requested | `13` | WORKING |
| Screenshots captured | `13` | WORKING |
| `pageerror` | `11` | BROKEN |
| `console.warning` | `3` | WORKING_WITH_DEFECTS |
| `console.error` | `10` | BROKEN |
| `requestfailed` | `1` | BROKEN |

## Route results

| Route | Final URL | HTTP | Tofu count | Buttons | Inputs | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/sign-in` | `/sign-in` | `200` | `0` | `2` | `2` | WORKING_WITH_DEFECTS |
| `/register` | `/register` | `200` | `0` | `1` | `2` | WORKING_WITH_DEFECTS |
| `/forgot-password` | `/forgot-password` | `200` | `0` | `3` | `1` | WORKING_WITH_DEFECTS |
| `/verify-email` | `/verify-email` | `200` | `0` | `3` | `1` | WORKING_WITH_DEFECTS |
| `/` | `/` | `200` | `0` | `68` | `0` | WORKING_WITH_DEFECTS |
| `/discover` | `/discover/` | `200` | `0` | `252` | `1` | WORKING_WITH_DEFECTS |
| `/activity` | `/sign-in` | `200` | `0` | `2` | `2` | SECURITY_BLOCKED |
| `/profile` | `/sign-in` | `200` | `0` | `2` | `2` | SECURITY_BLOCKED |
| `/settings` | `/settings/` | `200` | `0` | `17` | `1` | WORKING_WITH_DEFECTS |
| `/settings/appearance` | `/settings/appearance` | `200` | `0` | `20` | `6` | WORKING_WITH_DEFECTS |
| `/settings/security` | `/settings/security` | `200` | `0` | `9` | `0` | WORKING_WITH_DEFECTS |
| `/marketplace` | `/sign-in` | `200` | `0` | `2` | `2` | SECURITY_BLOCKED |
| `/marketplace/digital.modula.vault-notes` | `/sign-in` | `200` | `0` | `2` | `2` | SECURITY_BLOCKED |

## Runtime defects

| Defect | Status | Priority | Evidence |
| --- | --- | --- | --- |
| React hydration/runtime error `#418` across public routes | BROKEN | P1 | `pageerror` on sign-in, register, forgot password, verify email, Home, Discover, Activity, Profile, Appearance, Security, Vault Notes |
| `useNativeDriver` web warning | WORKING_WITH_DEFECTS | P2 | 3 console warnings on Home/Activity/Profile |
| API media blocked by cross-origin response policy | BROKEN | P1 | `requestfailed` for `https://api.modula.digital/v1/media/3a058370-a6fe-43ef-b318-e0579599cfa0.png` |
| Logged-out 401 fetches on protected routes | WORKING_WITH_DEFECTS | P2 | Expected API denial, but console surfaces noisy errors during redirects |

## Interpretation

Public rendering is not clean enough for UI redesign. React error `#418` and the blocked media request are P1 runtime/rendering defects. The expected logged-out 401s are not a direct auth defect, but they do create console noise and should be handled more deliberately during Phase 7L-B.
