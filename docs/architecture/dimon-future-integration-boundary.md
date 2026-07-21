# DIMON future integration boundary

Phase 6R prepares Greenfield for DIMON without activating an economic product surface.

## What ships now

- Stable Greenfield account IDs
- Extension capability namespaces (reserved `dimon:*` strings in `@modula/dimon-contracts`)
- Repository integrity / checkpoints as a future evidence substrate
- Settings → DIMON placeholder: “DIMON is not active yet…”

## What must not ship yet

- Balances, wallets, transfers, mining, staking, exchange, settlement
- Fake or demo DIMON currency
- Blockchain / smart-contract ledgers (ADR-006 / ADR-009)
- Storing economic state as ordinary profile fields
- AT Protocol / External Networks as the source of truth for DIMON

## Binding rule

When implemented, DIMON binds to `greenfield_accounts.account_id` through a dedicated ledger service boundary. Handle changes never rebind economic identity.

See [ADR-009](./adr/ADR-009-dimon-on-greenfield.md).
