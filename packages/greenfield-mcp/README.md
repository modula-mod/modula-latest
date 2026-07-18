# @modula/greenfield-mcp

Preview MCP server for Modula Greenfield architecture helpers.

This package intentionally does not use `@modelcontextprotocol/sdk`, blockchain
packages, wallet packages, or network clients. It implements the minimum
JSON-RPC/MCP stdio surface with Node built-ins only.

## Build

```sh
pnpm --filter @modula/greenfield-mcp build
```

## Run

Build first, then start the stdio server:

```sh
pnpm --filter @modula/greenfield-mcp start
```

From the workspace root:

```sh
pnpm mcp:greenfield
```

The package also exposes a bin after build:

```sh
pnpm --filter @modula/greenfield-mcp exec modula-greenfield-mcp
```

## Tools

- `greenfield.doctor` — preview status for Greenfield contracts, DIMON, and the
  intelligence model phrase.
- `greenfield.manifest.validate` — validates required
  GreenfieldModuleManifest-like fields from a JSON object or JSON string.
- `greenfield.intelligence.layers` — lists the canonical intelligence layers.
- `greenfield.atlas.summary` — returns approximate Feature Atlas domain counts
  from package-local static data.
- `greenfield.commands.list` — returns example command catalogue entries.
- `greenfield.forge.templates` — lists static Forge module templates and their
  surfaces/capabilities.
- `greenfield.dimon.status` — reports that DIMON is inactive and lists reserved
  capabilities without balances or wallet access.
- `greenfield.nft.status` — reports that NFT ownership records are reserved and
  no chain/wallet access exists.
- `greenfield.focus.policy` — returns Focus policy answers for a required
  `preset` argument: `off`, `light`, `deep`, or `custom`.
- `greenfield.privacy.levels` — lists Glass Privacy levels and preview
  enforcement hints.
- `greenfield.skill.template` — returns the `skill.md` section outline.

## Honesty rules

- Preview only: no live chain, wallet, publish, transfer, or settlement access.
- No balances, minting, NFT transfers, or blockchain RPC.
- DIMON is inactive.
- Tool responses describe contracts, manifests, commands, and architecture.
- The server does not execute commands; it returns static catalogue data.
