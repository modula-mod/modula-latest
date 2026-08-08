# Phase 7I Canonical Source Verification

Date: 2026-08-09

Scope:

- Canonical application source: `/root/modula-latest`
- Canonical Module Standard source: `/root/modula-mod/modula-module-standard`
- Canonical Vault Notes source: `/root/modula-mod/modula-vault-notes`

Gate:

- Executable source, runtime config, build scripts, tests, fixtures, and operations templates must not depend on legacy `/home/andrei` source paths.
- Historical documentation can mention prior paths, but executable scan targets do not include documentation.

Verifier:

```sh
pnpm verify:phase7i-canonical-source
```

Current scan targets:

- `services`
- `scripts`
- `packages`
- `src`
- `fixtures`
- `ops`
- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`

Expected result:

```text
Phase 7I canonical source verification passed
```
