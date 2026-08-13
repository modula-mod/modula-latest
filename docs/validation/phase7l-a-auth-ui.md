# Phase 7L-A Auth UI Audit

Date: 2026-08-13
Surface: production web, public mobile viewport `390x844`
Evidence directory: `docs/validation/evidence/phase7l-a/browser-public/`

## Screens captured

| Screen | Evidence | Render result | Status | Priority |
| --- | --- | --- | --- | --- |
| Login | `login-390x844.png` | 2 inputs, 2 buttons, no tofu text match | WORKING_WITH_DEFECTS | P1 |
| Register | `register-390x844.png` | 2 inputs, 1 button, no tofu text match | WORKING_WITH_DEFECTS | P1 |
| Forgot password | `forgot-password-390x844.png` | 1 input, 3 buttons, no tofu text match | WORKING_WITH_DEFECTS | P1 |
| Verify email / OTP | `verify-email-390x844.png` | 1 input, 3 buttons, no tofu text match | WORKING_WITH_DEFECTS | P1 |

## Defects

| Defect | Classification | Severity | Evidence |
| --- | --- | --- | --- |
| React hydration/runtime error on every auth route | BROKEN | P1 | `runtime-events.json` has `pageerror` React `#418` for `/sign-in`, `/register`, `/forgot-password`, `/verify-email` |
| Missing Apple/passkey affordance on visible sign-in screen | INCOMPLETE | P2 | `src/auth/screens/SignInScreen.tsx` exposes password and email-code flows only |
| Authenticated handoff not browser-proven | INCOMPLETE | P0 | API session proof exists, but no unredacted UI credentials were available for browser login |
| Web reload/cold restore cannot persist | BROKEN | P0 | `src/auth/storage/WebMemorySessionStorage.ts` is memory-only |

## Non-defects observed

| Item | Classification | Evidence |
| --- | --- | --- |
| Wrong password error domain | WORKING | API returns `INVALID_CREDENTIALS`, not OTP-domain error |
| Wrong OTP error domain | WORKING | API returns `CHALLENGE_INVALID` |
| Public auth route HTTP status | WORKING | Browser crawl status `200` for all auth routes |

## Follow-up for Phase 7L-B

1. Fix web session persistence or explicitly gate web beta as non-persistent.
2. Fix React hydration error `#418` before visual redesign.
3. Add/gate passkey and Apple affordances so visible auth promises match backend readiness.
4. Run browser password and OTP login with a controlled unredacted test account and record route transition to authenticated Home.
