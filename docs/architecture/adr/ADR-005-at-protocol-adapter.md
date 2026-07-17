# ADR-005: AT Protocol as optional adapter

## Status
Accepted (Phase 5)

## Decision
Modula owns its primary backend and private data.
AT Protocol may later become an optional public-social adapter.

## Potential AT Protocol uses
- public-post federation
- public follows
- account linking
- import/export
- cross-posting
- portable public identity

## AT Protocol must not initially own
- modules
- private profile data
- Teams
- Vault Notes
- Tasks
- CRM
- private messages
- marketplace purchases
- payments
- DIMON
- account recovery

## Consequences
- No AT Protocol SDK is installed in Phase 5
- Protocol contracts package documents the adapter boundary only
