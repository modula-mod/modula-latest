# Vault Notes — one release lineage

CANONICAL MODULE ID:
digital.modula.vault-notes

CANONICAL SOURCE:
modula-mod/modula-vault-notes

## Selected current version: 2.0.2

This is the current signed Module Standard 2.1 product release. It is tagged,
checksummed, self-verifying, published from the canonical repository, and live
in the production public registry. GreenField imports the immutable release
evidence rather than trusting the mutable repository head.

Inspected before choosing:

| Surface | Finding |
| --- | --- |
| External repo `package.json` | `@modula/vault-notes` **2.0.2** |
| External `module.manifest.json` | version **2.0.2**, Standard **2.1.0**, moduleId **digital.modula.vault-notes** |
| External `modula.module.json` | moduleVersion **2.0.2**, standardVersion **2.1.0**, id **digital.modula.vault-notes** |
| Git tags | Immutable release tags through `vault-notes-v2.0.2` |
| GitHub releases | Vault Notes 2.0.2; asset `modula-vault-notes-2.0.2.tgz` |
| Release commit | `bd5440278831cf97dfa2a6882125d207af013def` |
| Artifact SHA-256 | `2134d04aee1f3f59408f1fbab28c6de2a85aab314515941e16239a74a694c789` |
| Manifest SHA-256 | `b51470ea0ec8a3802557ac776675a12ec5f0bc9e13e6b885af3277d3cc78eae0` |
| Production registry | Public latest release is 2.0.2; no production mutation was performed by this reconciliation |

## Lineage

```
digital.modula.vault-notes
v0.1.0
├── source commit 915bbf2 (modula-mod/modula-module-vault-notes, recovered private)
└── HISTORICAL_RELEASE
v0.2.0
├── source commit 54ab8ed (modula-mod/modula-module-vault-notes, recovered private)
├── historical production release before the accessible source lineage was promoted
└── HISTORICAL / STALE live pointer — do not rewrite these bytes; cut current via a new release
v1.0.0
├── source commit 4b11dcb
├── tag vault-notes-v1.0.0
└── historical source release
v1.1.0
├── source commit f443972 (tag) / identity overlay main d92e445
├── tag vault-notes-v1.1.0
├── artifact sha256 46f918b07dc7d9c2734be4e6bb7729c137d316ceaa3f9d272da1bd7f78ad253a
└── historical provider-neutral AI-action release
v1.2.0
├── release commit c62f47a468c6d33fc5412db2d30f2b5d1c0bb2ce
├── tag vault-notes-v1.2.0
├── artifact sha256 98489d3c145fc4768c1bb86e8f470a1e58e509d0acee62fe3324410430cff935
├── Standard 2.1 extension points; no embedded AI/Voice implementation
└── historical extension-point release
v1.3.0..v2.0.1
└── historical releases in the same immutable lineage
v2.0.2
├── release commit bd5440278831cf97dfa2a6882125d207af013def
├── tag vault-notes-v2.0.2
├── artifact sha256 2134d04aee1f3f59408f1fbab28c6de2a85aab314515941e16239a74a694c789
├── manifest sha256 b51470ea0ec8a3802557ac776675a12ec5f0bc9e13e6b885af3277d3cc78eae0
└── CURRENT go-forward lineage
vZ
└── future — cut only from this repository, this module ID
```

Not a lineage:

```
modula.vault-notes 1.1.0
digital.modula.vault-notes 0.2.0
vault-notes-something 9.9.0
```

## Why not keep 0.2.0 as current

`0.2.0` cannot be byte-verified. Its declared source repository is not accessible. Keeping it as the live current release would permanently claim source maintainers cannot open.

`0.2.0` remains a historical registry release under the **same** module ID once identity unification is applied. It is not a competing product.

## Why 1.2.0 is no longer invented

Phase 7M-B correctly rejected writing `1.2.0` before such a release existed.
Phase 2 changed the actual module contract, verified the source, determined the
minor semver change, cut `vault-notes-v1.2.0`, generated provenance, published
the immutable artifact, and only then updated the canonical identity. Later
releases preserved that identity and culminated in the signed 2.0.2 release.

## Why 1.1.0 was a legitimate update

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

## Source identity

The source has declared `digital.modula.vault-notes` since the 2026-08-15
identity push. The 2.0.2 source manifest and artifact are canonical directly.
Greenfield keeps the legacy rewrite only for historical releases.
