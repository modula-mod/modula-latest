# Phase 6 — Native AT Protocol OAuth acceptance

Modula uses official `@atproto/oauth-client-expo` (native entry
`atprotoOAuthClient.native.ts`) with server-mediated OAuth
(`POST /v1/atproto/oauth/start` → browser → `modula://oauth/atproto` →
`GET /v1/atproto/oauth/callback`). Provider tokens stay on the API; the app never
stores or displays them. Web static export does not load the Expo OAuth native
module; web completes OAuth through the same Modula API routes.

## Builds (authoritative)

Expo Go is not authoritative for this test.

Use:

- native Simulator build (`pnpm exec expo run:ios`)
- physical iPhone development build (`pnpm exec expo run:ios --device`)

Rebuild after URL scheme or native module changes (`scheme: modula` →
`modula://oauth/atproto`).

## Environment

```bash
EXPO_PUBLIC_APP_ENV=preview
EXPO_PUBLIC_DATA_SOURCE=remote
EXPO_PUBLIC_API_URL=https://api.modula.digital
EXPO_PUBLIC_DEMO_SESSION=guest
```

Preview session (integration):

```bash
curl -sS -X POST https://api.modula.digital/v1/auth/preview/session \
  -H 'content-type: application/json' \
  -d '{"handle":"andrei.modula"}'
```

## Checklist

| Case | Simulator | Physical iPhone | Notes |
|---|---|---|---|
| Start connection | | | Settings → Connected Accounts → AT Protocol |
| Cancel | | | Dismiss browser auth session |
| Invalid handle | | | |
| Unknown PDS | | | |
| Provider denial | | | |
| Identity-only success | | | `requestScope=atproto` |
| Publishing permission request | | | After public-data acknowledgement |
| Publishing permission denial | | | |
| Publishing permission success | | | |
| Expired connection | | | |
| Revoked connection | | | |
| Reconnect | | | |
| Disconnect | | | |
| Unsolicited callback | | | Open `modula://oauth/atproto` with no pending state |
| Repeated callback | | | Same state twice |
| Offline callback | | | |

## Product gates

- Public-data warning acknowledged before publication scopes
- Default destination remains Modula only
- Private / followers / team / draft / unsupported media never offer AT cross-post
- Atmosphere Preview lives on Discover, not Home
- Profile AT connection appears under About only

## Acceptance status

| Surface | Status |
|---|---|
| `pod install` (includes ExpoAtprotoOAuthClient) | PASS |
| ExpoAtprotoOAuthClient Swift compile | PASS (observed in xcodebuild) |
| Full Simulator app link (`expo run:ios`) | FAIL on this machine after DerivedData clean — RN/dev-launcher `Sealable` / packager symbols; not an AT UI regression |
| Native Simulator OAuth end-to-end | PENDING after successful native install |
| Physical iPhone OAuth | PENDING / not attempted (no device run) |
| Cross-post public post | PENDING after OAuth |
| Private-content restriction | Implemented in Composer eligibility |

Retry native install with a normal (non-wiped) DerivedData tree:

```bash
cd ios && pod install && cd ..
pnpm exec expo run:ios
```
