# Session And Token Policy

Native refresh-token storage uses Expo SecureStore behind `src/auth/storage/SessionStorage.ts`.

SecureStore key: `modula.session.refresh-token.v1`

Access tokens are kept in memory through `AccessTokenStore`. Tokens are opaque and are not parsed as JWTs.

Web Phase 4 uses memory-only simulated token storage. Tokens are not written to LocalStorage.

Sign-out revokes the current session best-effort, clears the refresh token, clears access-token memory, cancels queries, clears account-specific cache and returns to Welcome.

SecureStore failures must not crash bootstrap. The runtime falls back to signed-out or guest browsing and does not fall back to AsyncStorage for tokens.
