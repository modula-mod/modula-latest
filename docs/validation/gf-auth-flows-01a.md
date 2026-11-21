# GF-AUTH-FLOWS-01a — auth flow hardening (PR A of Sentinel FLOWS-01 §39)

Base: main `8dc2dd60`. Owner: Forge. Certifier: Sentinel. Approved by ATLAS (split A/B/C).
Out of scope here: #193 and #194 (PR B, `forge/gf-auth-flows-01b`) and #196 (PR C, founder decision).

| Item | Change | Code |
| --- | --- | --- |
| #195 | Refresh rotation claims the presented token with one conditional `UPDATE … WHERE token_id = ? AND rotated_at IS NULL AND reused_at IS NULL AND revoked_at IS NULL AND expires_at > now AND EXISTS(active session) RETURNING token_id` inside the rotation transaction. Concurrent refreshes serialise on the row lock; the loser matches zero rows and takes the reuse path, which marks `reused_at` and revokes the whole token family (session `revoked`, event `session.refreshReuseDetected`). | `services/greenfield-api/src/sessions/service.ts` `refresh()` |
| #197 | `Cache-Control: no-store` and `Pragma: no-cache` on every response (success and error) of credential routes: `/v1/sessions` and `/v1/sessions/*`, `/v1/auth/*`, register, verify-email, resend-verification, forgot-password, reset-password, legacy recovery request/complete. | `services/greenfield-api/src/app/credential-routes.ts` |
| #198 | Body-required credential routes answer a missing, `null`, non-object or array body with 400 `VALIDATION_FAILED` (preValidation hook). An empty or unparseable JSON body on any credential route is 400 `VALIDATION_FAILED` in the standard envelope instead of Fastify's bare error. A blank `email` (resend-verification, forgot-password) or blank/non-string `refreshToken` is 400 `VALIDATION_FAILED`. | `credential-routes.ts`, `register-routes.ts` |
| INFO A | Per-account wrong-password throttle with stepped backoff on `POST /v1/sessions`. | `services/greenfield-api/src/auth/password-login-throttle.ts` |
| INFO B | `DELETE /v1/sessions/:sessionId` for a session owned by another account is 404 `NOT_FOUND`, identical to a missing session; the other session stays live. | `sessions/service.ts` `revokeSession()` now returns a boolean |

## Password throttle parameters

Stored in the existing `greenfield_auth_rate_limits` table (purpose `password_login_failure`); no migration.

- Key: SHA-256 of `${MODULA_SESSION_PEPPER}:password-login:${normalised email}`. Unknown emails are counted exactly like real ones, so the throttle never reveals which emails exist.
- Window: 15 minutes sliding. The count restarts when the previous failure is older than the window.
- Free failures: the 1st–4th wrong passwords answer 401 `INVALID_CREDENTIALS` as before.
- Backoff: the 5th failure sets a block of 30 s, then 60 s, 120 s, 240 s, capped at 300 s.
- While blocked, every password attempt (even the right password) is 429 `RATE_LIMITED` with `Retry-After` and is not counted, so the block cannot be extended past the cap. No hard lockout.
- Reset: a correct password (sign-in success, or `EMAIL_VERIFICATION_REQUIRED` for a pending account) deletes the count.
- Scope: password sign-in only. Passkey, Apple, email-code and recovery-code sign-in and password reset stay available during a block.
- Independent of `MODULA_RATE_LIMIT_ENABLED` (the per-IP limiter), like the existing challenge limits.

## Response shapes

429 throttle (`POST /v1/sessions`), header `Retry-After: 30`:

```json
{"ok":false,"error":{"code":"RATE_LIMITED","message":"Too many sign-in attempts. Try again later.","requestId":"…","retryable":true,"details":{"retryAfterSeconds":30}},"meta":{"requestId":"…","serverTime":"…"}}
```

400 missing body:

```json
{"ok":false,"error":{"code":"VALIDATION_FAILED","message":"Request body must be a JSON object","requestId":"…","retryable":false},"meta":{"requestId":"…","serverTime":"…"}}
```

404 foreign or missing session revoke:

```json
{"ok":false,"error":{"code":"NOT_FOUND","message":"Session not found","requestId":"…","retryable":false},"meta":{"requestId":"…","serverTime":"…"}}
```

Refresh reuse or lost race (401, whole session signed out):

```json
{"ok":false,"error":{"code":"UNAUTHENTICATED","message":"Refresh token reuse detected","requestId":"…","retryable":false},"meta":{"requestId":"…","serverTime":"…"}}
```

Clients must single-flight refresh: two parallel refreshes with the same token now sign the session out.

## Tests

`services/greenfield-api/tests/gf-auth-flows-01a.test.ts` (DB-gated; needs adding to the GF-TEST-DB-01 CI step once #189 lands). `api-baseline-02.security-acceptance` now expects 404 for the cross-account revoke.
