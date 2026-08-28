# Greenfield Backend V1 recovery

The Backend V1 recovery set is an atomic, encrypted and signed collection of
the Greenfield control-plane database, every declared managed module database,
and managed asset roots. Database archives retain owners and ACLs. A backup is
accepted only after checksum, decryption and archive-format verification.

The canonical tool is
`ops/backup/greenfield-backend-v1-recovery.mjs`. Configuration contains only
environment-variable names and data-resource identifiers; database URLs,
passwords, the age identity and the HMAC key stay outside Git.

## Required external material

- `MODULA_RECOVERY_AGE_RECIPIENT`: public age recipient used for encryption.
- `MODULA_RECOVERY_AGE_IDENTITY_FILE`: owner-only (`0600`) age identity path.
- `MODULA_RECOVERY_SIGNING_KEY`: at least 32 bytes, enrolled outside Git.
- `MODULA_RECOVERY_SIGNING_KEY_ID`: non-secret key version recorded in the
  manifest.
- database and asset environment variables named by the local recovery config.

Start from
`ops/backup/greenfield-backend-v1-recovery.example.json`. Replace its source
revision with the exact 40-character mainline SHA and declare every managed
database binding. An active dedicated PostgreSQL or object-storage resource
with Greenfield/product-service backup responsibility and no matching payload
causes backup creation to fail.

## Backup and verification

```text
node ops/backup/greenfield-backend-v1-recovery.mjs backup --config /etc/modula/recovery.json --output-root /var/backups/modula/greenfield-backend-v1
```

```text
node ops/backup/greenfield-backend-v1-recovery.mjs verify --config /etc/modula/recovery.json --backup-dir /var/backups/modula/greenfield-backend-v1/<backup-set>
```

The manifest contains counts and coverage classifications, ciphertext hashes,
required database roles, the exact source revision and the restore order. It
does not contain connection strings, passwords, credential handles or user
payloads. The manifest is authenticated with HMAC-SHA256; each payload is
encrypted independently with age.

## Isolated restore exercise

Start from
`ops/backup/greenfield-backend-v1-restore-targets.example.json`. Every database
target must be empty and positively named as a restore, recovery, DR or test
database. Asset targets must likewise be isolated and empty. The tool refuses
the active `modula`, `postgres` and template databases.

```text
node ops/backup/greenfield-backend-v1-recovery.mjs restore --config /etc/modula/recovery.json --backup-dir /var/backups/modula/greenfield-backend-v1/<backup-set> --targets /etc/modula/recovery-test-targets.json
```

Restore order is fixed:

1. Greenfield core.
2. Registry/installations and service/data bindings contained in core.
3. Secret and build metadata stores when separately registered.
4. Managed module databases.
5. Managed assets.
6. Event/job health and provenance reconciliation.

After restore, run migration status, API/worker database tests, registry and
module checks, asset checksums, service health and the global Backend V1 gate.
Record `last_restore_test_at` only after those checks pass. A production
cutover remains a separate operator-approved action; the recovery tool never
restores directly over the active production database.

## Canonical test

```text
CI=true pnpm verify:greenfield-backend-v1:recovery
```

This creates isolated source and target databases, a real managed-module
database and real asset files; migrates the source through migration 050;
backs up, verifies and deliberately tampers with a ciphertext; restores the
untampered set; verifies ACLs and zero pending migrations; reruns account-data
behavior; and removes every generated fixture.
