# Auth

Greenfield-owned Modula Account authentication.

## Session model

- Core product states: `ModulaAuthState` (`loading` | `signedOut` | `pendingVerification` | `signedIn` | `refreshing` | `suspended` | `error`)
- Shell also supports Phase 4 helpers on `SessionState` (`booting`, `guest`, …)

## Storage

Native SecureStore bundle (`modula.session.bundle.v1`) holds access token, refresh token, session ID, and expiry.
Tokens are never written to AsyncStorage. Web uses memory-only storage.

## API

- `POST /v1/accounts/register`
- `POST /v1/accounts/verify-email` / `resend-verification`
- `POST /v1/sessions` / `POST /v1/sessions/refresh`
- `DELETE /v1/sessions/current`
- `GET /v1/accounts/me`

Demo-owner bootstrap (`EXPO_PUBLIC_DEMO_SESSION=owner`) is development-only and never the production default.
