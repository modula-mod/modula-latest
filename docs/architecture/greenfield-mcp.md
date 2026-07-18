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
chain, wallet, publish, transfer, settlement, balance, NFT mint/transfer, or
module-registry write access.

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

### `greenfield.atlas.summary`

Returns an approximate, package-local summary of Feature Atlas domains. It does
not import app source, inspect user data, build a live graph, or call a network.

Current static domains:

- Shell, identity, and profile
- Social, messaging, and presence
- Modules, Registry, Marketplace, and Forge
- Intelligence, commands, and automation
- Attention, privacy, and safety
- Creation, economy, and optional inventory

### `greenfield.commands.list`

Returns a static catalogue of example commands:

- `notes.create`
- `tasks.create`
- `focus.start`
- `messaging.send`
- `module.install`
- `dimon.transfer` with a DIMON inactive note
- `dimon.asset.transfer` with a DIMON inactive and Preview blocked note

### `greenfield.forge.templates`

Returns static Forge module templates:

- Blank module
- Notes-shaped
- CRM-shaped
- Agent-shaped
- Commerce-shaped

The tool describes draft surfaces, capabilities, and permissions only. It does
not publish packages, install modules, run untrusted code, or settle commerce.

### `greenfield.dimon.status`

Reports the exact status phrase `DIMON is not active yet` and lists reserved
future capabilities. It does not expose balances.

### `greenfield.nft.status`

Reports that NFT ownership and entitlement records are reserved for a future
ownership layer. It does not expose chain RPC, wallet connections, balances,
funded-looking wallet addresses, floor prices, minting, transfers, or settlement.
It repeats the ADR-006 boundary: PostgreSQL is primary DB; blockchain is not the
app database.

### `greenfield.focus.policy`

Requires `preset` as `off`, `light`, `deep`, or `custom`. Returns the
FocusPolicyEngine preview answers used by surfaces such as notifications, feed,
Reels/discovery, chat, GAIA interruption, dock/drawer, Board, modules, and Focus
Halo.

The tool is informational only. Production enforcement depends on surface
adapters.

### `greenfield.privacy.levels`

Lists Glass Privacy levels:

- Disable Sharing
- Protected Chat
- Vault Chat

Responses include preview thread hints and must not describe these levels as
cryptographic, blockchain, wallet, or chain-backed protection.

### `greenfield.skill.template`

Returns the outline of the Modula module `skill.md` sections used as module
digital DNA for GAIA, AKI, and the Governor.
