# Modula platform tooling

**Status:** Preview foundations  
**Packages:** `@modula/greenfield-mcp`, `@modula/modula-cli`

## Purpose

Give developers and agents a governed way to inspect Modula Greenfield contracts, validate module manifests, and understand the intelligence / ownership model — without claiming live wallets, chain RPC, or unrestricted AI execution.

| Tool | Package | Entry |
| --- | --- | --- |
| Greenfield MCP | `@modula/greenfield-mcp` | `pnpm mcp:greenfield` |
| Modula CLI | `@modula/modula-cli` | `pnpm modula -- <cmd>` |
| Host Developer studio | App route | `/product/developer` |

## Cursor MCP

1. Build: `pnpm --filter @modula/greenfield-mcp build`
2. Copy `.cursor/mcp.json.example` → your Cursor MCP config (or merge the `modula-greenfield` server entry)
3. Tools include doctor, manifest validate, intelligence layers, commands, DIMON status, skill template

Details: `docs/architecture/greenfield-mcp.md`

## CLI

```sh
pnpm cli:build
pnpm modula -- doctor
pnpm modula -- module validate templates/modula-module/modula.module.json
pnpm modula -- dimon status
pnpm modula -- intelligence layers
```

Details: `docs/architecture/modula-cli.md`

## Honesty

- **DIMON is not active yet** — no balances, mining, staking, or decorative token UI.
- ADR-006: PostgreSQL remains the primary application database; blockchain is not the app DB.
- MCP/CLI do not publish modules, execute sandboxes, or call chain RPC.
- GAIA executes · AKI verifies · AGI Governor controls — tooling explains that model; it does not bypass it.

## Related

- `docs/architecture/intelligence-architecture.md`
- `docs/architecture/module-standards.md`
- `docs/architecture/dimon-future-integration-boundary.md`
- `templates/modula-module/skill.md`
