# Phase 7E Vault Notes Validation

Run from `/home/andrei/modula-latest`.

```bash
pnpm verify:phase7e-vault-notes-standard
pnpm verify:phase7e-vault-notes-data-integrity
pnpm verify:phase7e-vault-notes-lifecycle
pnpm verify:phase7e-vault-notes-search
pnpm verify:phase7e-vault-notes-security
pnpm verify:phase7e-vault-notes-host
pnpm verify:phase7e-vault-notes-release
pnpm verify:phase7e-vault-notes
```

The final verifier creates a disposable database from the configured Greenfield Postgres target, runs the live API and worker tests, rolls back migration 022, and drops the disposable database.

Production deployment is intentionally out of scope for Block 6.

Vault Notes immutable release evidence:

- release commit: `4b11dcb6c10d195692a0ea47425ee6bbcd7e196b`;
- release tag: `vault-notes-v1.0.0`;
- package checksum: `sha256:218ac984ee7ebd50565fb5481e67969ad0d5204cea859e096a4256b0274be122`;
- Standard release tag: `mms-v1.0.0`;
- Standard release commit: `ac1bede6e9be6518a21e8248596b99b4099da5c6`.
