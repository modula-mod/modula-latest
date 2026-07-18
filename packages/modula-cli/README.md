# @modula/modula-cli

Local developer CLI for Modula Greenfield package, module, and intelligence previews.

## Install/build in the workspace

```sh
pnpm --filter @modula/modula-cli build
```

The package exposes a `modula` bin after build:

```json
{
  "modula": "./dist/cli.js"
}
```

## Commands

```sh
modula help
modula doctor
modula atlas stats
modula mcp info
modula module validate <path-to-modula.module.json>
modula module init [--write]
modula forge templates
modula intelligence layers
modula commands list
modula commands search <q>
modula focus presets
modula focus policy <off|light|deep|custom>
modula privacy levels
modula dimon status
modula nft status
modula verify phase6s
modula version
```

From the workspace root, the root script runs the built CLI:

```sh
pnpm modula -- doctor
```

## Manifest validation

`modula module validate` reads a JSON manifest from disk and validates the current
`GreenfieldModuleManifest` shape without importing runtime dependencies.

It checks:

- required identity fields: `moduleId`, `name`, `repositoryUrl`, `packageVersion`
- `hostCompatibility.minimumHostVersion`
- `capabilities` and `permissions` arrays
- valid `uninstallBehaviour`
- optional contribution arrays for routes, profile tabs, board surfaces, and settings

## Module init

`modula module init` prints copy instructions for `templates/modula-module/`.
It does not write files by default.

If `--write` is passed, this preview CLI still prints path instructions instead of
copying files. This keeps the command simple and avoids creating module packages
inside the host repository by accident.

## Informational catalogues

- `atlas stats` prints a package-local, approximate Feature Atlas domain count.
- `forge templates` lists the static Blank, Notes-shaped, CRM-shaped,
  Agent-shaped, and Commerce-shaped module templates.
- `commands search <q>` searches the static command catalogue; it does not
  execute commands.
- `focus policy <preset>` prints FocusPolicyEngine preview answers for Off,
  Light, Deep, or Custom.
- `privacy levels` lists Glass Privacy levels and preview enforcement hints.
- `nft status` reports that NFT ownership records are reserved until DIMON is
  active.
- `verify phase6s` prints the command to run:
  `pnpm verify:phase6s-social-frontend`.

## Honest boundaries

This CLI is intentionally local and informational:

- no runtime dependencies
- no package publishing
- no fake install success
- no wallet balances
- no DIMON economic activity
- no blockchain or smart-contract RPC calls

DIMON status must remain:

```txt
DIMON is not active yet
```

See `docs/architecture/modula-cli.md` for the architecture boundary.
