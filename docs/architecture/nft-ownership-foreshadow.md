# NFT ownership foreshadow

## Status

Reserved / inactive. DIMON is not active yet.

This document explains how Modula can talk about NFT and digital ownership ideas
without pretending to run a mint marketplace, wallet, or blockchain backend.

## Product meaning

NFTs in Modula are planned as ownership proofs and entitlement records, not a
speculative casino. The product language is limited to:

- module entitlements
- creator editions
- profile collectibles
- team credentials
- ownership proofs for portability, audit, or access

The product must not show:

- fake balances
- funded-looking wallet addresses
- floor prices presented as live
- mint buttons that claim success
- transfer buttons that claim success
- settlement, chain RPC, wallet connection, or marketplace trading claims

Mint and transfer controls are allowed only as disabled Preview blocked affordances.

## Data boundary

ADR-006 remains binding: PostgreSQL is the primary application database.
Blockchain is not the app database.

Future DIMON proofs may reference application records, but app state, social
graph state, module state, entitlements, and policy state remain in Greenfield
services backed by Postgres unless a later ADR explicitly changes that boundary.

## Reserved contract surface

`@modula/dimon-contracts` reserves names only:

- `DimonAssetId`
- `DimonCollectionId`
- `DimonAssetReservation`
- `dimon:asset:read`
- `dimon:asset:mint:request`
- `dimon:asset:transfer:request`
- `dimon:asset:entitlement:read`
- `dimon.asset.mint.requested`
- `dimon.asset.transfer.requested`
- `dimon.asset.entitlement.reserved`
- `dimon.asset.metadata.reserved`

These are not emitted, persisted, settled, indexed on a chain, or treated as
balances in this phase.

## UI surface

`/product/nft` is an honest product foreshadow:

- prominent status phrase: `DIMON is not active yet`
- seeded Preview collection stubs with names only and `Reserved` status
- creator flow Preview: define collection, metadata, AKI scan, Governor policy,
  Ledger, DIMON settlement
- holder view Preview with local-only entitlement examples
- links to DIMON status, Ledger, Ownership, Marketplace, and Developer Tools

## Tooling surface

Local developer tools must repeat the inactive boundary:

- CLI: `modula nft status`
- MCP: `greenfield.nft.status`
- command catalogue: `dimon.asset.transfer`

All three surfaces must state that DIMON is inactive and NFT records are reserved
only. They must not perform network, wallet, chain, mint, transfer, or settlement
operations.
