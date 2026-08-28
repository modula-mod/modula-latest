# Greenfield Backend V1 recovery checkpoint

Recorded: 2026-08-28

Status: **SOURCE AND ISOLATED RECOVERY PASS**

Production mutation: **none**. Production remains at schema 043; migrations
044 through 050 and production recovery-set acceptance remain queued for the
production-convergence checkpoint.

## Executed gate

```text
CI=true pnpm verify:greenfield-backend-v1:recovery
```

Result: `GREENFIELD BACKEND V1 RECOVERY PASS`.

The isolated exercise created four disposable PostgreSQL databases: a
Greenfield source migrated through 050, a module-owned source database, and an
empty target for each. It also created a disposable managed asset tree and a
new age identity held outside the repository for the duration of the run.

## Behavioral evidence

- real account/export/delete data was written before backup;
- Greenfield schema, registry, installations, events, jobs, entitlements,
  build metadata and account-data request counts were inventoried;
- one active dedicated-PostgreSQL ledger resource was bound to its real module
  database payload;
- Greenfield and module database archives retained owners and ACLs;
- all three payloads (Greenfield, module DB and assets) were age encrypted;
- the HMAC-authenticated manifest contained no URL, password or secret handle;
- format/decryption/checksum verification passed;
- a modified ciphertext was rejected;
- ordered restore recovered the registry, module rows, managed assets, secret
  metadata tables and event/job ledgers;
- `modula_backup` ACL recovery passed;
- account-data behavioral tests passed against the restored Greenfield DB;
- restored pending migrations were `[]`;
- all test databases, role, keys, assets and backup artifacts were removed.

The exercise proves the recovery mechanism and order without claiming that the
current production database has already been advanced to migration 050 or that
an off-server backup destination has been enrolled.
