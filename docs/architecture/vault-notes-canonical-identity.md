# Vault Notes — canonical identity

There is one Vault Notes. This document is the identity decision, not a discussion.

CANONICAL PRODUCT NAME:
Vault Notes

CANONICAL MODULE ID:
digital.modula.vault-notes

CANONICAL GITHUB REPOSITORY:
modula-mod/modula-vault-notes

CANONICAL PUBLISHER:
Modula

CANONICAL RELEASE LINEAGE:
digital.modula.vault-notes

LEGACY IDs:
modula.vault-notes → alias / migration only
modula.module.vaultNotes → alias / migration only
module-vault-notes → alias / migration only

LEGACY REPOSITORIES:
modula-mod/modula-module-vault-notes → archive / redirect only (inaccessible to this mission: GitHub 404)

DATA NAMESPACE:
module.digital.modula.vault-notes

## Decision

Product Hub identity `digital.modula.vault-notes` is preserved because it is the installed product identity.

The accessible, buildable, testable source is `modula-mod/modula-vault-notes`.

Those two facts are not two products. A Git repository name is not a module ID.

After this decision:

- ONE PRODUCT
- ONE MODULE ID
- ONE SOURCE REPOSITORY
- ONE RELEASE LINEAGE
- ONE REGISTRY ENTRY
- ONE INSTALLATION IDENTITY
- ONE DATA NAMESPACE

Old identifiers exist only as migration aliases / tombstones. They must not produce a second Product Hub card, a second installation, a second data store, or a second update channel.

Alias resolution happens before module identity reaches business logic.

An account may have 0 or 1 logical Vault Notes installation. Extra family rows are collapsed. The unique database key remains `(account_id, extension_version_id)` because installations do not store `module_id`; the runtime invariant enforces one family install.

## Inspection that produced this decision

| Candidate | Result |
| --- | --- |
| `modula-mod/modula-vault-notes` | Exists, public, HEAD `4f2c3c9`, tags `vault-notes-v1.0.0` and `vault-notes-v1.1.0`, builds and self-verifies. Declared source ID in-tree is still `modula.vault-notes` until the source overlay is pushed. |
| `modula-mod/modula-module-vault-notes` | Outcome **D/E**: GitHub returns 404 / “Could not resolve to a Repository”. No unique source could be recovered from this agent. Do not delete historical Git evidence if it later reappears; archive and redirect. |

No third Vault Notes repository is created.

## Trust chain

```
Product Hub
    ↓
canonical module release  digital.modula.vault-notes
    ↓
manifest                  module.manifest.json (canonical ID overlay)
    ↓
repository                modula-mod/modula-vault-notes
    ↓
commit SHA                tagged release commit
    ↓
release/tag               vault-notes-v1.1.0 (current)
    ↓
artifact checksum         release asset SHA-256
```

Every arrow must resolve. Product Hub must not claim `modula-mod/modula-module-vault-notes` as live source.
