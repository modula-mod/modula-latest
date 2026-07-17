# Phase 6 — AT Protocol frontend integration handoff

Backend commit: 7dc3ca4abf2177258552e7b4e66347662dcbae9e
API URL: https://api.modula.digital
API version: v1
Protocol version: 0.1

OAuth web metadata: https://api.modula.digital/oauth/atproto/web-client-metadata.json
OAuth native metadata: https://modula.digital/oauth/atproto/native-client-metadata.json
Native redirect URI: modula://oauth/atproto

Connection endpoints:
- GET `/v1/atproto/connections`
- POST `/v1/atproto/oauth/start`
- GET `/v1/atproto/oauth/callback`
- POST `/v1/atproto/connections/:connectionId/disconnect`
- POST `/v1/atproto/connections/:connectionId/refresh`
- GET `/v1/atproto/connections/:connectionId/status`

Publication endpoints:
- Worker-driven via post create/update/delete outbox (`atproto.publish.create|update|delete`)
- Preferences: GET/PATCH `/v1/atproto/preferences`

Atmosphere endpoint:
- GET `/v1/atproto/feed?mode=connected|following|modula-network`

Backend capabilities (`/v1/meta`):
- authentication / mutations
- atprotoOAuth / atprotoPublishing / atprotoImport
- pdsPilot (false while deferred)

Preview auth for integration:
- POST `/v1/auth/preview/session` `{ "handle": "andrei.modula" }` → Bearer access token

PDS status: DEFERRED
Tap status: PREPARED

Known limitations:
- Migration `003_phase6_api_rls_writes` grants `modula_api` write policies on FORCE RLS tables (posts, profiles, post_saves, profile_links)
- Live provider OAuth completion uses official `@atproto/oauth-client-node`; preview callback supports disposable `preview=1` completion for tests
- Atmosphere feed is selective projection, not a network AppView
- Private Modula data remains PostgreSQL-only
- Search indexing is asynchronous via the worker (`search.index.post` / `search.index.profile`)
