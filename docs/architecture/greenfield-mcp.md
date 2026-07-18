# Greenfield MCP preview server

**Status:** Preview helper  
**Package:** `@modula/greenfield-mcp`

`@modula/greenfield-mcp` exposes Modula Greenfield architecture helpers through
a minimal MCP-compatible JSON-RPC server over stdio. It is designed for Cursor
and other MCP clients that need quick access to Greenfield manifest, command,
DIMON, and intelligence-layer reference material.

The server is intentionally small:

- no `@modelcontextprotocol/sdk`
- no blockchain packages
- no wallet packages
- no network clients
- Node built-ins only at runtime

## Cursor wiring

Build the package first:

```sh
pnpm --filter @modula/greenfield-mcp build
```

Example `mcp.json` entry:

```json
{
  "mcpServers": {
    "modula-greenfield": {
      "command": "pnpm",
      "args": [
        "--filter",
        "@modula/greenfield-mcp",
        "exec",
        "node",
        "dist/stdio.js"
      ]
    }
  }
}
```

You can also run it from the workspace root:

```sh
pnpm mcp:greenfield
```

or directly after build:

```sh
pnpm --filter @modula/greenfield-mcp start
```

## Honesty rules

This server is an architecture and contract preview. It must not claim live
chain, wallet, publish, transfer, settlement, balance, or module-registry write
access.

DIMON remains inactive. Responses may describe reserved DIMON capabilities, but
must not fabricate balances, wallets, settlement status, or blockchain state.

Command responses are catalogue examples only. The MCP server does not execute
commands against Modula, Greenfield, DIMON, wallets, users, or external
services.

## Tools

### `greenfield.doctor`

Returns a phase/status summary for:

- Greenfield contracts
- inactive DIMON
- intelligence model phrase: `GAIA executes · AKI verifies · Governor controls`

### `greenfield.manifest.validate`

Accepts `manifest` as a JSON string or object. Validates required
GreenfieldModuleManifest-like fields:

- `moduleId`
- `name`
- `packageVersion`
- `hostCompatibility.minimumHostVersion`
- `permissions` array
- `uninstallBehaviour`

Returns `{ ok, errors }`.

### `greenfield.intelligence.layers`

Lists the canonical layers with one-line roles:

- GAIA
- AKI
- Governor
- Circuit Memory
- Kaizen
- Foundry
- Claims Graph
- Ledger
- Command Layer
- Forge

### `greenfield.commands.list`

Returns a static catalogue of example commands:

- `notes.create`
- `tasks.create`
- `focus.start`
- `messaging.send`
- `module.install`
- `dimon.transfer` with a DIMON inactive note

### `greenfield.dimon.status`

Reports the exact status phrase `DIMON is not active yet` and lists reserved
future capabilities. It does not expose balances.

### `greenfield.skill.template`

Returns the outline of the Modula module `skill.md` sections used as module
digital DNA for GAIA, AKI, and the Governor.
