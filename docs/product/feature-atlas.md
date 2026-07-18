# Feature Atlas

The Feature Atlas is Modula's browsable product map. It names capabilities across shell, social, Profile-OS, modules, Forge, marketplace, intelligence, DIMON/NFT direction, and planned module families.

Source: `src/features/product/data/featureAtlas.ts`
Route: `/product/atlas`

## What it is

- A registry of 266 named capabilities.
- A way to search by name, domain, maturity, route, summary, and tags.
- A filterable surface for domain and maturity: `live`, `preview`, `planned`, `inactive`.
- A routing map to existing surfaces where they exist, or an atlas-filter fallback for planned-only areas.

## What it is not

- Not proof that every capability has a production runtime.
- Not fake module execution, billing, wallet, minting, or marketplace settlement.
- Not a claim that DIMON, NFT, or blockchain features are active.

Honesty line used in-product:

> Atlas maps Modula’s surface area. Preview ≠ production runtime.

## DIMON / NFT rule

DIMON, NFT, and ownership-economics entries are `inactive` or `planned`. Their summaries state that DIMON is not active yet and avoid fake wallet balances, mints, token prices, trades, or live ownership claims.

## Helpers

The data module exports:

- `FEATURE_ATLAS`
- `ATLAS_DOMAINS`
- `ATLAS_DOMAIN_LABELS`
- `ATLAS_MATURITY_COUNTS`
- `atlasCountsByMaturity()`
- `atlasByDomain(domain)`
- `atlasSearch(q)`
