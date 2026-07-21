# Greenfield AT Protocol Bridge

Optional, revocable external bridge. It does **not** own Modula accounts, handles, sessions, or repositories.

Runtime implementation currently lives in:

- `services/greenfield-api/src/bridges/atproto`
- `services/greenfield-worker/src/bridges/atproto`

Disabled by default (`MODULA_ATPROTO_ENABLED=false`).
