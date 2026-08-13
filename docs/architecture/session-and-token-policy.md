# Session And Token Policy

Native session storage uses Expo SecureStore behind `src/auth/storage/SessionStorage.ts`.

SecureStore key: `modula.session.bundle.v1` (access token, refresh token, session ID, token expiry).

Legacy key `modula.session.refresh-token.v1` is migrated on read and then removed.

`AccessTokenStore` mirrors the access token in memory for request headers. Tokens are opaque and are not parsed as JWTs.

Web uses one deliberate persistent storage owner: `WebPersistentSessionStorage`.

Web key: `modula.web.session.bundle.v1` in `localStorage` (access token, refresh token, session ID, access-token expiry, refresh-token expiry when supplied by the API).

Reason: the current Greenfield auth API is bearer-token based and does not yet issue HTTP-only cookie sessions. Persisting the opaque bundle is the narrow Phase 7L-B repair that lets web sessions survive reload and browser restart without adding a second cookie auth model.

Scope: only `src/auth/storage/WebPersistentSessionStorage.ts` may read or write this key. UI code, repositories, route params, logs, query cache, AsyncStorage, and other localStorage keys must not store token material.

Expiry and refresh: bootstrap reads the bundle, refuses expired refresh-token metadata locally when present, refreshes through `POST /v1/sessions/refresh`, and then replaces the stored bundle with the rotated tokens. If refresh fails definitively or `/v1/accounts/me` rejects the access fallback, the local bundle is cleared.

XSS implication: bearer material in `localStorage` is readable by successful same-origin script injection. Until Greenfield moves to a deliberately designed HTTP-only cookie session model, this increases the importance of CSP, dependency review, no inline secret logging, and keeping token writes isolated to the storage adapter.

On refresh reuse / revocation: clear the local session bundle, send the user to Sign In, and show a safe security message (no technical token details).

logout/sign-out revokes the current Greenfield session best-effort (`DELETE /v1/sessions/current`), clears SecureStore or the web session bundle, clears access-token memory, cancels queries, clears account-specific cache and returns to Welcome.

SecureStore or web storage failures must not crash bootstrap. The runtime falls back to signed-out or guest browsing and does not fall back to AsyncStorage for tokens.

Demo-owner bootstrap (`EXPO_PUBLIC_DEMO_SESSION=owner`) is development-only and is never the production default.
