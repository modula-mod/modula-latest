# Session And Token Policy

Native session storage uses Expo SecureStore behind `src/auth/storage/SessionStorage.ts`.

SecureStore key: `modula.session.bundle.v1` (access token, refresh token, session ID, token expiry).

Legacy key `modula.session.refresh-token.v1` is migrated on read and then removed.

`AccessTokenStore` mirrors the access token in memory for request headers. Tokens are opaque and are not parsed as JWTs.

Web uses memory-only simulated token storage. Tokens are not written to LocalStorage or AsyncStorage.

On refresh reuse / revocation: clear the local session bundle, send the user to Sign In, and show a safe security message (no technical token details).

Sign-out revokes the current Greenfield session best-effort (`DELETE /v1/sessions/current`), clears SecureStore, clears access-token memory, cancels queries, clears account-specific cache and returns to Welcome.

SecureStore failures must not crash bootstrap. The runtime falls back to signed-out or guest browsing and does not fall back to AsyncStorage for tokens.

Demo-owner bootstrap (`EXPO_PUBLIC_DEMO_SESSION=owner`) is development-only and is never the production default.
