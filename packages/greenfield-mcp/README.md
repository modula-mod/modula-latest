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
- `greenfield.commands.list` — returns example command catalogue entries.
- `greenfield.dimon.status` — reports that DIMON is inactive and lists reserved
  capabilities without balances or wallet access.
- `greenfield.skill.template` — returns the `skill.md` section outline.

## Honesty rules

- Preview only: no live chain, wallet, publish, transfer, or settlement access.
- DIMON is inactive.
- Tool responses describe contracts, manifests, commands, and architecture.
- The server does not execute commands; it returns static catalogue data.
