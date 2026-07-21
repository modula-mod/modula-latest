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

Updated in PART 5 (2026-07-17). Full checklist: `docs/validation/phase6-part5-acceptance.md`.

| Surface | Status |
|---|---|
| `pod install` (includes ExpoAtprotoOAuthClient) | PASS |
| ExpoAtprotoOAuthClient Swift compile | PASS |
| Full Simulator app link / `xcodebuild` Debug | PASS — ensure **Debug** React-Core prebuilt (Sealable/Packager present); Release core after wipe causes `expo-dev-launcher` undefined symbols |
| Metro `@atproto/oauth-client-expo` | PASS with pnpm patch `patches/@atproto__oauth-client-expo@0.1.8.patch` (published `./expo-oauth-client.js` missing; use platformless import) |
| Native Simulator AT connection UI | PASS — Settings → Connected Accounts → AT Protocol loads; Connect identity + public-data warning visible |
| Native Simulator OAuth end-to-end | PENDING — browser OAuth not completed in PART 5 (no disposable AT interactive run) |
| Physical iPhone OAuth | SKIP — no deployable iPhone attached (Nicola’s offline; Mac listed as “Andrei Milea”) |
| Cross-post public post | PENDING after OAuth |
| Private-content restriction | Implemented in Composer eligibility (`evaluateCrossPostEligibility`) |

Force Debug React-Core after a bad wipe:

```bash
cd ios/Pods
echo Release > React-Core-prebuilt/.last_build_configuration
node ../node_modules/react-native/scripts/replace-rncore-version.js -c Debug -r 0.86.0 -p "$(pwd)"
cd ../..
pnpm exec expo run:ios
```
