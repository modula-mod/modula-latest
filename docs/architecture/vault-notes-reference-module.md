# Vault Notes Reference Module

Vault Notes 1.0 is the first external module used to prove Modula Module Standard 1.0 outside the main application.

## Boundary

Vault Notes lives in `/home/andrei/modula-mod/modula-vault-notes`.

The main application only hosts it through generic Greenfield module systems:

- registry release metadata;
- compatibility and permission preview;
- installation lifecycle;
- module record collections;
- declarative views and actions;
- generic structured JSON field rendering;
- module settings and health rendering;
- unified search projection.

The main app must not add `src/features/vault-notes`, app-level Vault Notes routes, or Vault Notes-specific database tables.

## Route

Canonical route:

`/module/modula.vault-notes`

Subpaths are resolved through the generic module host:

- `/module/modula.vault-notes/note/<noteId>`;
- `/module/modula.vault-notes/folder/<folderId>`;
- `/module/modula.vault-notes/search`;
- `/module/modula.vault-notes/settings`.

## Release

Vault Notes 1.0 release identity:

- module ID: `modula.vault-notes`;
- module version: `1.0.0`;
- standard version: `1.0.0`;
- manifest schema version: `1.0.0`;
- data schema version: `1.0.0`;
- release tag: `vault-notes-v1.0.0`;
- release commit: `4b11dcb6c10d195692a0ea47425ee6bbcd7e196b`;
- package checksum: `sha256:218ac984ee7ebd50565fb5481e67969ad0d5204cea859e096a4256b0274be122`;
- Standard tag: `mms-v1.0.0`;
- Standard commit: `ac1bede6e9be6518a21e8248596b99b4099da5c6`.

Development may use a local filesystem checkout. Production must use checksum-pinned release metadata from the registry.
