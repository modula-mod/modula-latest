# Phase 7M-B6 — Vault Notes 1.1.0 cutover rehearsal

Prepared. **Not executed.**

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
```

## Environments

| Environment | Vault Notes | Source |
| --- | --- | --- |
| Production | `latestVersion = 0.2.0` | unchanged |
| B6 candidate / test registry | `1.1.0` | `modula-mod/modula-vault-notes` |

Canonical ID remains `digital.modula.vault-notes`.

## Rehearsal checklist (do not run against production)

1. Backup current registry projection and install rows
2. Migration rehearsal on a candidate database
3. Existing install compatibility (`keepData` reinstall)
4. Alias validation for legacy IDs
5. Registry update to 1.1.0
6. Version agreement between manifest, release, and Product Hub
7. Rollback to 0.2.0 projection

Evidence manifests must state which environment produced them. Screenshots must not lie about production.
