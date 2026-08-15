# Vault Notes production registry dump

Recorded 2026-08-15 via `ssh modula-vps` from Mac.
Working tree: `/root/modula-latest` detached at `e5d4b946fdf80fb82f0ae0963bdd3a087ff5e97a`.
Database: production `modula-production-greenfield-postgres-1` / database `modula`.
**No mutation.** Production deploy remains NO.

## Classification

| Kind | Module ID | Version | Source | Classification |
| --- | --- | --- | --- | --- |
| extension | digital.modula.vault-notes | published | — | CANONICAL product identity |
| release | digital.modula.vault-notes | 0.1.0 | modula-mod/modula-module-vault-notes@915bbf2 | HISTORICAL_RELEASE |
| release | digital.modula.vault-notes | 0.2.0 | modula-mod/modula-module-vault-notes@54ab8ed | STALE live pointer (historically accurate bytes; not go-forward source) |
| catalogue | digital.modula.vault-notes | 0.2.0 active | — | CANONICAL card |
| catalogue | modula.module.vaultNotes | 1.0.0 unavailable | — | LEGACY_ALIAS (hidden) |
| module_id `modula.vault-notes` | — | — | — | absent as a registry product |

## Installations

| Version | Status | Installs | Accounts |
| --- | --- | --- | --- |
| 0.1.0 | installedDisabled | 1 | 1 |
| 0.1.0 | removed | 2 | 2 |
| 0.2.0 | enabled | 6 | 6 |
| 0.2.0 | installedDisabled | 1 | 1 |
| 0.2.0 | removed | 1 | 1 |

One account has both 0.1.0 disabled and 0.2.0 enabled (same module ID, two version rows). Runtime collapse must present one logical install.

## Records

| Module ID | Collection | Total | Live | Accounts |
| --- | --- | --- | --- | --- |
| digital.modula.vault-notes | note | 5 | 3 | 3 |
| digital.modula.vault-notes | folder | 5 | 3 | 3 |

No `modula.vault-notes` record namespace in production. Identity migration for installed notes is a no-op: they already live under the canonical ID.

## Cleanup not applied to production

Importing 1.1.0 or rewriting 0.2.0 `source_repository` would change live production while this mission's deploy gate is NO.

After founder visual approval / 7M-C deploy:

1. Import `modula-mod/modula-vault-notes@vault-notes-v1.1.0` as a new published release of `digital.modula.vault-notes`.
2. Keep 0.1.0 / 0.2.0 as historical releases of the same module ID.
3. Leave `modula.module.vaultNotes` catalogue row unavailable / alias-only.
4. Offer Update to accounts on 0.2.0. Same notes. New source SHA.

Do not rewrite founder notes. Do not test DELETE DATA on founder accounts.
