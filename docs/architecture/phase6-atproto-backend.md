# Phase 6 — Backend expansion and AT Protocol bridge

## Starting point
- Starting branch: `main`
- Starting commit: `2214d9f7e802ff903f285c4faf92e5cd7b2fe1a2`
- Backend branch: `phase6-atproto-backend`

## Architecture
Modula PostgreSQL remains authoritative for accounts, sessions, private social graph
operations, notifications, moderation, and module data.

AT Protocol is an optional public-identity bridge:
- official OAuth (`@atproto/oauth-client-node`)
- progressive scopes (`atproto` first, publishing later)
- asynchronous Modula → AT publication via worker/outbox
- selective ingestion (not a Relay / AppView)

## Services
```text
services/api     — authenticated HTTP API, capability enforcement, OAuth start/callback
services/worker  — PostgreSQL job leases, outbox handlers, AT publish/ingest
packages/atproto-lexicons — experimental digital.modula.temp Lexicons
```

## Frontend boundary
VPS must not modify `src/`, `ios/`, `android/`, or `assets/` during backend work.
Required frontend changes go in `docs/handoffs/phase6-frontend-handoff.md`.

## Security invariants
- Actor identity always comes from the server session
- Capabilities are checked per route
- OAuth state is single-use and session-bound
- Provider session material is encrypted at rest (AES-256-GCM)
- SSRF protections wrap outbound AT/PDS fetches
- Private Modula data never enters AT repositories

## Non-goals
- Full Relay
- Complete AppView
- App-password authentication
- Custom OAuth / custom cryptography
- Primary-account migration onto the pilot PDS
