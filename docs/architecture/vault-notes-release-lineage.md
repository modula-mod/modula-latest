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
| External `module.manifest.json` | version **1.1.0**, moduleId **digital.modula.vault-notes** after Mac push `d92e445` |
| External `modula.module.json` | moduleVersion **1.1.0**, standardVersion **1.2.0**, id **digital.modula.vault-notes** |
| Git tags | `vault-notes-v1.0.0`, `vault-notes-v1.1.0` |
| GitHub releases | Vault Notes 1.1.0 latest; asset `modula-vault-notes-1.1.0.tgz` |
| Production registry (Mac `ssh modula-vps` dump) | `digital.modula.vault-notes` **0.2.0** sourced from `modula-mod/modula-module-vault-notes@54ab8ed` (now archived; historically accurate) |
| Invented 1.2.0 | Rejected in 7M-B and rejected again here |

## Lineage

```
digital.modula.vault-notes
v0.1.0
├── source commit 915bbf2 (modula-mod/modula-module-vault-notes, recovered private)
└── HISTORICAL_RELEASE
v0.2.0
├── source commit 54ab8ed (modula-mod/modula-module-vault-notes, recovered private)
├── production current until 1.1.0 is imported after visual approval
└── HISTORICAL / STALE live pointer — do not rewrite these bytes; cut current via a new release
v1.0.0
├── source commit 4b11dcb
├── tag vault-notes-v1.0.0
└── historical source release
v1.1.0
├── source commit f443972 (tag) / identity overlay main d92e445
├── tag vault-notes-v1.1.0
├── artifact sha256 46f918b07dc7d9c2734be4e6bb7729c137d316ceaa3f9d272da1bd7f78ad253a
└── CURRENT go-forward lineage
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

Mac push completed 2026-08-15 (`d92e445`). Source files now declare
`digital.modula.vault-notes`. The tagged 1.1.0 artifact still contains the
legacy ID; Greenfield overlays it at import so registry rows stay canonical.
