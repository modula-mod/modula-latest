# Modula CLI

**Package:** `@modula/modula-cli`  
**Bin:** `modula`  
**Status:** local Greenfield developer companion

## Purpose

The Modula CLI gives developers a small local entry point for Greenfield readiness
checks, module manifest validation, and informational previews of Modula platform
concepts.

It is not a module installer, publisher, wallet, ledger, or blockchain client.

## Package boundary

The CLI lives at `packages/modula-cli` and follows the package shape used by
`packages/greenfield-contracts`:

- private workspace package
- ESM TypeScript
- `tsc -p tsconfig.json` build
- `tsc -p tsconfig.json --noEmit` typecheck
- no runtime dependencies

The `modula` bin points at `./dist/cli.js` and the TypeScript source includes the
Node shebang so the built file starts with:

```sh
#!/usr/bin/env node
```

## Command surface

| Command | Responsibility |
| --- | --- |
| `modula help` | Print available commands and honesty boundary |
| `modula doctor` | Print Greenfield host readiness checks |
| `modula mcp info` | Explain the current MCP run boundary |
| `modula module validate <path>` | Read and validate a manifest JSON file |
| `modula module init [--write]` | Print instructions for copying `templates/modula-module/` |
| `modula intelligence layers` | Print GAIA / AKI / AGI Governor layers |
| `modula commands list` | Print a sample command catalogue |
| `modula focus presets` | Print Off / Light / Deep / Custom presets |
| `modula dimon status` | Print `DIMON is not active yet` |
| `modula version` | Print the package version |

## Manifest validation

`module validate` intentionally validates the JSON shape locally instead of
loading a runtime package. That keeps the CLI dependency-free while matching the
public `GreenfieldModuleManifest` contract:

- required strings: `moduleId`, `name`, `repositoryUrl`, `packageVersion`
- required `hostCompatibility.minimumHostVersion`
- required string arrays: `capabilities`, `permissions`
- `uninstallBehaviour`: `retainData`, `purgeData`, or `exportThenPurge`
- optional contribution arrays: `routes`, `profileTabs`, `boardSurfaces`, `settings`
- optional string arrays: `functions`, `tools`, `widgets`, `schemas`
- optional string-valued `migrationMetadata`

This validation is a local developer check. It does not install, execute, sandbox,
publish, or trust module code.

## MCP boundary

The current workspace does not ship a packaged Greenfield MCP server. The CLI's
`mcp info` command explains the intended local run pattern for a future package
and states that the CLI does not start or fake an MCP process.

When a real MCP server package lands, it should be launched through a workspace
package command such as `pnpm --filter <greenfield-mcp-package> ...` and remain
bound to Greenfield contracts and local development surfaces.

## DIMON boundary

DIMON remains inactive until the shell, social surface, and module standards are
stable. The CLI must not show balances, wallets, transfers, mining, staking,
settlement, fake DIMON currency, or blockchain RPC status.

The required status output is:

```txt
DIMON is not active yet
```

## Intelligence model

The CLI uses the canonical intelligence wording:

- GAIA executes
- AKI verifies
- AGI Governor controls

These commands are informational previews only. They do not run unrestricted
agents or silently access private module data.
