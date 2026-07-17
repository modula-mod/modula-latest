# Phase 6R — Greenfield Sovereign Backend

Public product remains **Modula**. The authoritative backend is **Greenfield**.

## Service names

| Role | Package | Path |
| --- | --- | --- |
| Greenfield API | `@modula/greenfield-api` | `services/greenfield-api` |
| Greenfield Worker | `@modula/greenfield-worker` | `services/greenfield-worker` |
| Optional AT bridge | `@modula/greenfield-bridge-atproto` | `services/greenfield-bridges/atproto` (stub; runtime under `*/bridges/atproto`) |

Public HTTP endpoint remains `https://api.modula.digital`.

## Account authority

- Modula users create Modula accounts owned by Greenfield.
- Permanent `account_id` (UUIDv7) never changes when handle, email, password, or external bridges change.
- Handles are changeable with history.
- Email is an auth identity, not a primary key.
- AT Protocol DIDs are never Greenfield account IDs.

## Native authentication

Invite-only preview registration:

Invite → email → password → handle → verify email → active session → default repository → profile record

Sessions use opaque access/refresh tokens, hashed at rest, with refresh rotation and reuse detection.

Passwords use Argon2id (`@node-rs/argon2`).

## Records and integrity

Each account receives a default Greenfield repository. Records are schema-validated, revisioned, and append event-hashed with canonical JSON + SHA-256. Checkpoints are Ed25519-signed integrity markers — not a blockchain.

Private records never enter public outbox payloads.

## Extension kernel

Modules, plugins, functions, tools, connectors, widgets, and bridges use Greenfield manifests and trust levels. Untrusted manifests cannot execute. Arbitrary marketplace code is not auto-executed.

## AT Protocol boundary

AT Protocol is an optional, disabled-by-default bridge. It is not required for registration, sign-in, posting, profiles, or repositories.

## DIMON boundary

`@modula/dimon-contracts` reserves future economic identifiers and capabilities only. No balances, wallets, transfers, or ledger implementation in Phase 6R.

## Related ADRs

- ADR-007 Greenfield sovereign account model
- ADR-008 Greenfield extension kernel
- ADR-009 DIMON on Greenfield
