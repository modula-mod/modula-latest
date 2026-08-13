# Phase 7L-A Auth Journey Audit

Date: 2026-08-13
Evidence:

- `docs/validation/evidence/phase7l-a/api-production-audit-v2.jsonl`
- `docs/validation/evidence/phase7l-a/api-production-audit-v3-targeted.jsonl`
- `docs/validation/evidence/phase7l-a/api-production-audit-v4-password-vault.jsonl`
- `docs/validation/evidence/phase7l-a/browser-public/runtime-events.json`
- Source files:
  - `src/auth/runtime/SessionProvider.tsx`
  - `src/auth/storage/WebMemorySessionStorage.ts`
  - `src/auth/screens/SignInScreen.tsx`

Controlled accounts in the evidence are redacted in artifact output. Request IDs and session IDs below are non-secret audit handles.

## API journey

| Journey | Result | Status | Priority | Evidence |
| --- | --- | --- | --- | --- |
| Email verification wrong code | Correctly denied | WORKING | P0 | `401 CHALLENGE_INVALID`, request `cfe1740f-87ac-4b61-a67d-7ff1291bc773` |
| Email verification replay | Correctly denied | WORKING | P0 | `401 CHALLENGE_REPLAYED`, request `a2694331-e4b3-4b38-af9f-98d6ddb40279` |
| Password login | Creates session | WORKING | P0 | Alpha `POST /v1/sessions` `200`, request `02b71625-caf3-4c94-ab30-cdc904161b0b`, session `019ffbb5-4a5a-7785-9956-0a12b7f3fddc`; beta `200`, request `eec18f77-c4ae-4d7c-9ae4-dff147a28f27` |
| Wrong password | Correctly denied with password-domain error | WORKING | P0 | `401 INVALID_CREDENTIALS`, request `f70df9e3-667b-44f1-ac02-3ccfd4b5f544` |
| `/v1/accounts/me` after password login | Authenticated account returned | WORKING | P0 | `200`, request `d7f432e5-d543-42c5-8907-699442de5985`, account status `active` |
| Refresh token | Refresh succeeds | WORKING | P0 | `POST /v1/sessions/refresh` `200`, request `f95a9d67-5801-4d82-b495-efac58225bbe` |
| Refresh token reuse | Correctly revokes/rejects | WORKING | P0 | `401 UNAUTHENTICATED`, request `1e91560f-bf21-4d01-b98e-f80ae1f6d` |
| Email OTP request | Challenge created | WORKING | P0 | `POST /v1/sessions/email-code/request` `200`, request `f91f19ce-7ce9-40c3-af5c-2f4aa3827104` |
| Wrong OTP | Correctly denied with OTP-domain error | WORKING | P0 | `401 CHALLENGE_INVALID`, request `6d8cc4d3-ad94-4533-8efa-1a6315f8aff2` |
| Correct OTP | Creates session | WORKING | P0 | `POST /v1/sessions/email-code` `200`, request `9983bbfe-32d9-498f-9d17-363fbf317509`, session `019ffbb5-4c53-7ca9-b947-ae0474365e79` |
| OTP replay | Correctly denied | WORKING | P0 | `401 CHALLENGE_REPLAYED`, request `ea3ddc43-62c6-47f8-a5d4-38842ea13e20` |
| Password reset | Reset succeeds when DB-token audit path finds the recovery token | WORKING_WITH_DEFECTS | P0 | v4 reset `200`, request `b6de02b3-002d-422b-802b-957d4febf424`; old password denied request `6b2804a9-35b4-45ec-822b-cce0bb4eba64`; new password accepted request `2c16af16-7345-4ccf-90a8-3521b288eb2f` |
| Logout | Current session revoked | WORKING | P0 | `DELETE /v1/sessions/current` `200`, request `8141ca45-3c4f-42b3-92d6-3cef9a1451bb`; `/v1/accounts/me` then `401`, request `9cbd357f-f857-4efd-896f-ad3c65a549b1` |

## Browser/session handoff

| Journey | Result | Status | Priority | Evidence |
| --- | --- | --- | --- | --- |
| Public sign-in render | Route renders with 2 inputs and 2 buttons | WORKING_WITH_DEFECTS | P1 | `browser-public/login-390x844.png`; runtime route status `200`; also logs React hydration error `#418` |
| Authenticated UI handoff | API evidence proves real sessions; browser evidence does not include unredacted credentials | INCOMPLETE | P0 | No unredacted UI password is present in the Phase 7L-A artifacts, so the browser journey from submit to authenticated Home remains a required follow-up |
| Reload restore on web | Source stores web session in process memory only | BROKEN | P0 | `src/auth/storage/WebMemorySessionStorage.ts` says web keeps bundle in memory only; hard reload/cold browser cannot restore after process memory loss |
| Cold browser restore on web | Not persistent by implementation | BROKEN | P0 | Same source proof as reload restore |
| Native restore | SecureStore path exists, but Mac simulator build/run was not executed in this Linux audit environment | INCOMPLETE | P0 | `src/auth/storage/NativeSecureSessionStorage.ts`; see `docs/validation/phase7l-a-native-audit.md` |

## Required answer

"Successful login" currently means the production API creates a real session and `/v1/accounts/me` returns the authenticated account. It is not yet proven that the deployed browser UI reliably transitions into an authenticated Modula session, because the browser crawl was unauthenticated and the web storage implementation cannot survive a reload/cold browser restore.
