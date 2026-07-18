# @modula/dimon-contracts

Reserved capability and event identifiers for the future DIMON ownership layer on Greenfield.

## Status

**Inactive.** The Modula host must keep the product phrase:

> DIMON is not active yet

No balances, wallets, transfers, mining, staking, or blockchain dependencies are implemented here.

## What this package is

- Opaque ID types (`DimonAccountId`, `DimonAssetId`, …)
- Capability strings (`dimon:account:read`, …)
- Reserved NFT / digital ownership types (`DimonAssetReservation`, not minted)
- Event envelope types (not emitted)
- Extension reservation id `modula.dimon.core`

## What this package is not

- A wallet SDK
- A ledger implementation
- A marketplace settlement runtime

See `docs/architecture/adr/ADR-009-dimon-on-greenfield.md` and `/settings/dimon` in the host.
