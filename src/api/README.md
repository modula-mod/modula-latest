# Modula API Runtime

Phase 4 routes every server-shaped request through `ApiClient` and the
`ApiTransport` contract. The active transport is local by default; the HTTP
transport is present for a future backend and is not activated silently in
production.
