# ADR-009 — DIMON on Greenfield

## Status

Accepted (Phase 6R) — **prepare only**

## Context

DIMON is planned as Modula’s first-party economic system. It must not be bolted onto profile fields, AT Protocol repositories, or a blockchain. Greenfield already (or will) provide stable account IDs, capability namespaces, event integrity, and extension manifests — the correct foundation.

## Decision

1. **DIMON will be a first-party Greenfield economic protocol and service.**
2. DIMON uses Greenfield accounts, capabilities, events, extension manifests, and repository integrity infrastructure.
3. **DIMON balances and transactions will not be stored as ordinary profile fields.**
4. DIMON will use a **dedicated ledger and security boundary** (separate from social record collections).
5. Phase 6R **must not implement** issuance, transfers, wallets, mining, staking, exchange, settlement, or smart contracts.
6. Phase 6R **must prepare**:
   - stable account IDs
   - event integrity / checkpoints
   - extension capability namespaces
   - future economic-account binding
   - future ledger service boundary

Placeholder contracts live in `@modula/dimon-contracts` (identifiers and capability names only).

## Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| Store balances on profile records | Wrong trust boundary; pollutes social/profile schemas |
| Implement fake currency now | Creates irreversible product debt and abuse surface |
| Blockchain / tokens / mining | Forbidden; PostgreSQL remains authoritative (ADR-006) |
| Put economic data on AT Protocol | Public bridge must never own private economic state |

## Consequences

- No DIMON UI, balances, or transfers in Phase 6R.
- Capability strings such as `dimon:account:read` are reserved for future grants.
- Greenfield checkpoints and event hashes may later support DIMON evidence — they are not a blockchain.
- Economic plugins (when built) follow ADR-008 trust/install rules as first-party plugins.

## Migration / sequencing

1. PART 1 — reserve `@modula/dimon-contracts`.
2. Later — ledger service, binding table from `greenfield_accounts` to `DimonAccountId`, audited transactions.
3. Bridges never become the source of truth for DIMON state.
