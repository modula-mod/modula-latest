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
modula-mod/modula-module-vault-notes → archive / redirect only

DATA NAMESPACE:
module.digital.modula.vault-notes

## Decision

Product Hub identity `digital.modula.vault-notes` is preserved because it is the installed product identity.

The go-forward, buildable, testable source is `modula-mod/modula-vault-notes`.

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
| `modula-mod/modula-vault-notes` | Exists, public, and independently versioned. Current stable tag `vault-notes-v2.0.2` resolves to `bd5440278831cf97dfa2a6882125d207af013def`; `pnpm verify` passes. The manifest ID is `digital.modula.vault-notes`, Standard is 2.1.0, and the module remains standalone while exposing extension points. |
| `modula-mod/modula-module-vault-notes` | Outcome **C**: private, recoverable from Mac. Cloud agents saw GitHub 404 (D/E). Contains unique historical Greenfield source for production `0.1.0` (`915bbf2`) and `0.2.0` (`54ab8ed`), plus an older MMS 0.3 host-rendered JSON prototype. Last push before archival: 2026-07-26. Archived with README redirect. History retained. Not deleted. |

No third Vault Notes repository is created.

The recovered legacy repository does not contain a reason to make it canonical: it does not build/test/self-verify as a Standard 1.1 module. Production 0.2.0 is a historical release of the same module ID, not a second product.

## Trust chain

```
Product Hub
    ↓
canonical module release  digital.modula.vault-notes
    ↓
manifest                  module.manifest.json (canonical ID in source as of d92e445)
    ↓
repository                modula-mod/modula-vault-notes
    ↓
commit SHA                bd5440278831cf97dfa2a6882125d207af013def
    ↓
release/tag               vault-notes-v2.0.2 (current)
    ↓
artifact checksum         2134d04aee1f3f59408f1fbab28c6de2a85aab314515941e16239a74a694c789
```

Every arrow must resolve. Product Hub must not claim `modula-mod/modula-module-vault-notes` as live source. Historical 0.2.0 rows may keep that repository as provenance of the bytes that were imported; they are not the current lineage.
