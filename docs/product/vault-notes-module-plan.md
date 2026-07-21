# Vault Notes Module Plan

Vault Notes is the first-party reference module for private notes and saved knowledge. It is intentionally external to the host repository.

## Package

- Repository: `modula-mod/modula-module-vault-notes`
- Local path: `/home/andrei/modules/modula-module-vault-notes`
- Package: `@modula-mod/vault-notes-module`
- Module ID: `digital.modula.vault-notes`
- Version: `0.1.0`
- Trust: firstParty
- Licence status: firstParty
- Product state: Foundation / Preview

## Data

- Notes collection: `module.digital.modula.vault-notes.note`
- Folders collection: `module.digital.modula.vault-notes.folder`
- Default visibility: private
- Allowed visibility in v1: private, teams
- Public and follower visibility are rejected.

## Contributions

- Routes: `/module/digital.modula.vault-notes`, `/module/digital.modula.vault-notes/note/:noteId`
- Board surfaces: launcher, recent notes summary
- Profile tab: owner-only, disabled by default
- Settings: Settings -> Modules -> Vault Notes
- Tools: Save to Vault, Create Vault Note
- Functions: create-note, save-post, search

Functions are contract-only until reviewed Greenfield handlers exist.

## Exclusions

Vault Notes v0.1.0 has no React Native screens, no native dependencies, no standalone backend runtime, no network permission, no DIMON permission, no plugins, and no connectors.
