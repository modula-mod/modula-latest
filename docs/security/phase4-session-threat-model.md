# Phase 4 Session Threat Model

## Protected Assets

- refresh token
- access token
- session identity
- private account data
- protected actions

## Threats

- token leakage in logs
- token storage in AsyncStorage
- token exposure through route parameters
- stale account cache after sign-out
- refresh storms
- session fixation
- unsafe return-to links
- accidental production demo login
- cross-account query leakage
- malformed API responses
- offline mutation confusion

## Phase 4 Mitigations

- SecureStore on native for refresh tokens
- memory-only access-token mirror for request headers
- web session persistence isolated to `WebPersistentSessionStorage` and one namespaced `localStorage` key
- query cache clearing on account changes
- refresh mutex
- opaque token contracts
- capability checks
- runtime response decoding
- safe return-to validation
- local API clearly labelled
- production cannot silently use local demo data

The local simulator is a development runtime, not a production security boundary.
