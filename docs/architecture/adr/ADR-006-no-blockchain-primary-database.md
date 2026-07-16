# ADR-006: No blockchain as primary application database

## Status
Accepted (Phase 5)

## Decision
PostgreSQL is the authoritative primary application database.
Tamper-evident audits may be added using standard hashes and signed checkpoints after a dedicated security review.

## Forbidden in Phase 5
- mining
- consensus
- wallets
- tokens
- chains
- smart contracts
- custom signatures presented as a database substitute

## Consequences
- Application state, social graph, and modules persist in PostgreSQL
- Audit and outbox tables provide operational event foundations without a ledger
