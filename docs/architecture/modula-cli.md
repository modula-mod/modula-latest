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
| `modula atlas stats` | Print approximate package-local Feature Atlas domain counts |
| `modula atlas count` | Print the static host atlas `500+` entry-count statement |
| `modula design principles` | Print short X / Apple remap bullets for Modula product direction |
| `modula mcp info` | Explain the current MCP run boundary |
| `modula module validate <path>` | Read and validate a manifest JSON file |
| `modula module init [--write]` | Print instructions for copying `templates/modula-module/` |
| `modula forge templates` | List static Forge module templates |
| `modula intelligence layers` | Print GAIA / AKI / AGI Governor layers |
| `modula commands list` | Print a static command catalogue |
| `modula commands search <q>` | Search the static command catalogue |
| `modula focus presets` | Print Off / Light / Deep / Custom presets |
| `modula focus policy <preset>` | Print FocusPolicyEngine preview answers |
| `modula privacy levels` | Print Glass Privacy levels and preview hints |
| `modula dimon status` | Print `DIMON is not active yet` |
| `modula nft status` | Print reserved NFT/ownership status without chain access |
| `modula verify phase6s` | Print the Phase 6s social frontend verification command |
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

The workspace ships `@modula/greenfield-mcp` as a packaged local preview server.
The CLI's `mcp info` command explains the local run pattern and states that the
CLI does not start or fake an MCP process.

The MCP server should be launched through a workspace package command such as
`pnpm --filter @modula/greenfield-mcp start` and remain bound to Greenfield
contracts, local development surfaces, and static preview catalogues.

## Static catalogue boundary

`atlas stats`, `atlas count`, `design principles`, `forge templates`,
`commands list/search`, `focus policy`, and `privacy levels` duplicate small
package-local summaries. They must not import app source or present the data as
live telemetry, runtime state, user data, or chain RPC.

`verify phase6s` intentionally prints:

```sh
pnpm verify:phase6s-social-frontend
```

It does not shell out from the CLI.

## DIMON boundary

DIMON remains inactive until the shell, social surface, and module standards are
stable. The CLI must not show balances, wallets, transfers, mining, staking,
settlement, fake DIMON currency, NFTs as active assets, floor prices,
funded-looking wallet addresses, or blockchain RPC status.

The required status output is:

```txt
DIMON is not active yet
```

`modula nft status` must also state that NFT ownership and entitlement records
are reserved only, that mint/transfer requests are Preview blocked, and that
ADR-006 keeps PostgreSQL as the primary application database. Blockchain is not
the app database.

## Intelligence model

The CLI uses the canonical intelligence wording:

- GAIA executes
- AKI verifies
- AGI Governor controls

These commands are informational previews only. They do not run unrestricted
agents or silently access private module data.
