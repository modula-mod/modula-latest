# Vault Notes — one release lineage

CANONICAL MODULE ID:
digital.modula.vault-notes

CANONICAL SOURCE:
modula-mod/modula-vault-notes

## Selected current version: 1.1.0

This number is not “the next integer”. It is the only tagged, checksummed, self-verifying release that exists in the accessible source repository.

Inspected before choosing:

| Surface | Finding |
| --- | --- |
| External repo `package.json` | `@modula/vault-notes` **1.1.0** |
| External `module.manifest.json` | version **1.1.0** |
| External `modula.module.json` | moduleVersion **1.1.0**, standardVersion **1.2.0** |
| Git tags | `vault-notes-v1.0.0`, `vault-notes-v1.1.0` |
| GitHub releases | Vault Notes 1.1.0 latest; asset `modula-vault-notes-1.1.0.tgz` |
| Production registry (prior 7M-B audit) | `digital.modula.vault-notes` **0.2.0** sourced from inaccessible `modula-mod/modula-module-vault-notes` |
| Invented 1.2.0 | Rejected in 7M-B and rejected again here |

## Lineage

```
digital.modula.vault-notes
v0.2.0
├── source commit 54ab8ed (historical registry row)
├── claimed repository modula-mod/modula-module-vault-notes (inaccessible)
└── HISTORICAL_RELEASE — retained as history, not a second product
v1.0.0
├── source commit 4b11dcb
├── tag vault-notes-v1.0.0
└── historical source release
v1.1.0
├── source commit f443972 (tag) / main 4f2c3c9
├── tag vault-notes-v1.1.0
├── artifact sha256 46f918b07dc7d9c2734be4e6bb7729c137d316ceaa3f9d272da1bd7f78ad253a
└── CURRENT
vZ
└── future — cut only from this repository, this module ID
```

Not a lineage:

```
modula.vault-notes 1.1.0
digital.modula.vault-notes 0.2.0
vault-notes-something 1.2.0
```

## Why not keep 0.2.0 as current

`0.2.0` cannot be byte-verified. Its declared source repository is not accessible. Keeping it as the live current release would permanently claim source maintainers cannot open.

`0.2.0` remains a historical registry release under the **same** module ID once identity unification is applied. It is not a competing product.

## Why not invent 1.2.0

1.2.0 is larger than both 0.2.0 and 1.1.0 and has no upstream tag, package version, or artifact. 7M-B correctly reverted an invented 1.2.0. This mission does not recreate it.

## Why 1.1.0 is a legitimate update

If an account is installed on `digital.modula.vault-notes@0.2.0`, moving current to `1.1.0` from the accessible repository is a real source-SHA change:

```
old canonical state
    ↓
Update available
    ↓
review
    ↓
update
    ↓
same notes
    ↓
new source SHA active
```

That is a reason to offer Update. It is not an animation test cut.

## Identity overlay until the source repo is pushed

The cloud agent cannot push `modula-mod/modula-vault-notes` (GitHub app has pull, not push). The host therefore overlays canonical identity at import:

- stored module ID = `digital.modula.vault-notes`
- stored source repository = `modula-mod/modula-vault-notes`
- stored version = `1.1.0`

Mac must apply the same identity to the source repository with the maintainer GitHub identity. See `docs/architecture/vault-notes-source-mac-push.md`.
