# ADR-007 — Greenfield sovereign account model

## Status

Accepted (Phase 6R)

## Context

Phase 6 delivered authenticated Modula social APIs and an AT Protocol OAuth + publication bridge. Useful infrastructure landed (sessions, capabilities, outbox, worker jobs, SSRF controls), but product language and some flows risked implying that AT Protocol / Bluesky identity is required for Modula.

Modula needs a sovereign account authority:

- Users create **Modula accounts**.
- **Greenfield** owns account IDs, handles, profiles, sessions, and repositories.
- AT Protocol (and future ActivityPub) are **optional bridges**, never account authorities.
- PostgreSQL remains the authoritative operational database (see ADR-006).
- Private records must never enter public bridge streams.

Related: `ADR-007-progressive-at-oauth-async-publication.md` remains the bridge-behaviour ADR for progressive AT OAuth and async publication. This ADR supersedes any reading of Phase 6 that treats AT identity as primary.

## Decision

1. **Modula accounts are created and owned by Greenfield.**
2. **Greenfield account IDs, handles, repositories, and sessions are authoritative.**
3. Account IDs are stable opaque identifiers (UUIDv7). Do **not** introduce a custom DID method.
4. Handles may change; account IDs never change when handle, email, password, external connections, or profile fields change.
5. Email and external protocol IDs are not primary keys.
6. Account **deletion** and **deactivation** are distinct statuses.
7. External protocols may connect through optional, revocable **Greenfield Bridges**.
8. Bridges do not own Modula identities, private data, modules, marketplace, payments, or future DIMON ledgers.
9. Public API hostname remains `api.modula.digital`; the internal backend system name is **Greenfield**.

## Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| AT Protocol / PDS as primary account store | Violates Modula sovereignty; couples private product to public federation |
| Custom DID method for Modula accounts | Invents identity crypto/protocol surface; UUIDv7 is sufficient and stable |
| Dual-primary Modula + AT accounts | Ambiguous authority; recovery and UX failure modes |
| Blockchain or custom ledger as account DB | Forbidden by ADR-006 and Phase 6R rules |

## Consequences

- Registration and sign-in copy must never require AT Protocol or Bluesky.
- Core UI speaks **Modula Account**, **Greenfield**, **Connections**, **External Networks**.
- AT Protocol may remain under Settings → Connections → External Networks → AT Protocol.
- Existing AT tables, OAuth, and worker jobs become bridge infrastructure (rename/generalise in later parts).
- New contracts live in `@modula/greenfield-contracts` and `@modula/greenfield-protocol`.
- PART 2 implements Greenfield account/session/repository persistence; PART 1 defines architecture and contracts only.

## Migration from current Phase 6

1. Keep sessions, capabilities, social writes, outbox, worker, backups.
2. Generalise AT publication jobs → external bridge jobs; connection/status/preferences similarly.
3. Move AT OAuth, ingest, lexicons, Composer AT destination to optional bridge packaging over time (`git mv` preferred).
4. Remove AT from core account/onboarding language immediately (PART 1).
5. On VPS (PART 2): introduce `greenfield_accounts` (and related tables), link existing social rows, rename services to `greenfield-api` / `greenfield-worker`.
6. Do not force-push or rewrite PR #4 history in PART 1; corrective branch carries forward.

## External bridge boundary

Bridges may:

- Link an external identity to a Greenfield account (with explicit user consent).
- Mirror **explicitly public** records the user opts to publish.
- Import/export public-adjacent data under capability controls.

Bridges must not:

- Own account recovery, sessions, or handles.
- Receive private records, modules, Teams, Vault Notes, Tasks, CRM, DMs, marketplace, payments, or DIMON ledger data.
- Block Modula post commit on bridge failure (async outbox remains).

## Private-data restrictions

- Visibility classes include `public`, `followers`, `teams`, `private`, `system`.
- Private / system records must never enter public event streams or bridge payloads.
- Public logs must not include sensitive record bodies.

## DIMON implications

- DIMON will bind to Greenfield account IDs and capability namespaces (see ADR-009).
- Phase 6R prepares identifiers and integrity primitives only — no balances, transfers, wallets, or fake currency.
