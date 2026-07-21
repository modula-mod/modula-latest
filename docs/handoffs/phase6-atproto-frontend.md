# Phase 6 — AT Protocol frontend integration handoff

Backend branch: `phase6-atproto-backend`
Backend commit: tip of `origin/phase6-atproto-backend` (verify with `git rev-parse HEAD` after pull)
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
- authentication / mutations: true
- atprotoOAuth / atprotoPublishing / atprotoImport: true
- pdsPilot: false (deferred)

Preview auth for integration:
- POST `/v1/auth/preview/session` `{ "handle": "andrei.modula" }` → Bearer access token

PDS status: DEFERRED
Tap status: PREPARED

Deployed on VPS preview:
- API + worker + Postgres via `ops/docker/compose.preview.yml`
- Migration `003_phase6_api_rls_writes` applied (API write policies on FORCE RLS tables)
- Public smoke: health, meta, feed, search, Atmosphere, OAuth metadata → HTTP 200

Known limitations:
- Live provider OAuth completion uses official `@atproto/oauth-client-node`; preview callback supports disposable `preview=1` completion for tests
- Atmosphere feed is selective projection, not a network AppView
- Private Modula data remains PostgreSQL-only
- A few early `search.index.post` jobs were dead-lettered under a stale worker image; current worker completes them
- Do not merge PR #4 until Mac PART 3 frontend lands and PART 4/5 acceptance complete
