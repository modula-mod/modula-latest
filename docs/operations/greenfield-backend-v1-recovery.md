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
database and real asset files; migrates the source through migration 052;
backs up, verifies and deliberately tampers with a ciphertext; restores the
untampered set; verifies ACLs and zero pending migrations; reruns account-data
behavior; and removes every generated fixture.

## Off-host copy (GF-OPS-02, opt-in)

Every copy of a recovery set on the VPS is lost with the VPS (SPOF register,
"Backup destination"). `ops/backup/greenfield-v1-offhost.mjs` copies a
verified set off the host. It never decrypts and adds no plaintext: before
copying it checks the manifest HMAC with `MODULA_RECOVERY_SIGNING_KEY` (fail
closed: `push`, `pull` and `check` refuse to run without the key, and `pull`
stages nothing; there is no opt-out), that every file is declared by the
signed manifest, that every payload starts with the age header, and that every
ciphertext digest matches. The destination receives the set under
`<target>/<set-id>/` and then `<target>/<set-id>.receipt.json`, written last
as the commit marker; a set without a receipt is never listed or pulled.

It is disabled unless explicitly enabled in
`/etc/modula/greenfield-platform-recovery.env` (no secrets in these values):

```text
MODULA_OFFHOST_BACKUP_ENABLED=1
MODULA_OFFHOST_BACKUP_TARGET=ssh://modula-backup@offhost.example/srv/modula/greenfield-v1
# or a separately mounted disk/NFS export: file:///mnt/modula-offhost/greenfield-v1
# MODULA_OFFHOST_BACKUP_REQUIRED=1   # make an off-host failure fail the backup run
```

`ssh://` uses `rsync` over `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes`;
the SSH key and pinned `known_hosts` entry live in root's SSH configuration,
never in Git or in the target URI (URIs with a password are rejected). `rsync`
must be installed on both hosts. Use a destination account that can write only
its own directory; append-only or object-lock storage on the destination is
recommended so a compromised VPS cannot delete history.

When enabled, `ops/backup/greenfield-v1-backup.mjs` pushes each verified set
first, records `last-offhost-success.json` or `last-offhost-failure.json`, and
only then writes `last-success.json` (atomically; its `offhost.status` is
`disabled`, `copied` or `failed`). With `MODULA_OFFHOST_BACKUP_REQUIRED=1` an
off-host failure fails the run and `last-success.json` is not updated, so it
keeps pointing at the previous fully successful run (and the deploy gate's
freshness check fails). Without it the local set stays valid,
`last-success.json` is written with `offhost.status: "failed"`, and the
failure marker must be alerted on. Off-host retention is managed at the
destination; the local retention job does not delete off-host copies.

Manual use:

```text
MODULA_OFFHOST_BACKUP_ENABLED=1 node ops/backup/greenfield-v1-offhost.mjs push --dry-run --backup-dir /var/backups/modula/greenfield-v1/<set>
MODULA_OFFHOST_BACKUP_ENABLED=1 node ops/backup/greenfield-v1-offhost.mjs push --backup-dir /var/backups/modula/greenfield-v1/<set>
MODULA_OFFHOST_BACKUP_ENABLED=1 node ops/backup/greenfield-v1-offhost.mjs list
```

The age identity (`MODULA_RECOVERY_AGE_IDENTITY_FILE`) and HMAC key must be
escrowed separately from both the VPS and the off-host destination; an
off-host copy without them is unrecoverable by design.

## Restore drill from the off-host copy

Run on a disposable host or a disposable database cluster, never against the
production database:

```text
node ops/backup/greenfield-v1-restore-drill.mjs \
  --set <gbv1-recovery-...> --staging /var/lib/modula/restore-drill/stage \
  --config /etc/modula/recovery.json --targets /etc/modula/recovery-test-targets.json \
  --report /var/lib/modula/restore-drill/report.json
```

`--staging` must resolve (symlinks included) strictly inside
`MODULA_RESTORE_DRILL_ROOT` (default `/var/lib/modula/restore-drill`, a dedicated
directory whose name contains restore/recovery/dr/drill/test as a segment) and
must not overlap the backup output root, a `file://` off-host target or the
checkout; `..` traversal, sibling-prefix names and escaping symlinks are refused.
The drill pulls the committed off-host copy into that empty isolated staging
directory, verifies it against the receipt and signed manifest, runs the
recovery tool's `verify` and `restore` (targets must be empty and named
restore/recovery/DR/test), then checks schema version and inventory counts
against the signed manifest and requires zero pending/unknown migrations
against the checkout. `--compare-url-env NAME` additionally compares every
public table's row count, content digest and role grants with a comparison
database; use it only when that database is itself disposable. Record the
report and the date as `last_restore_test_at` only when it exits 0.

`CI=true pnpm verify:greenfield-v1-offhost-backup` covers the copy contract
against a local fake remote (disabled default, dry-run, receipt-last commit,
tamper/plaintext/undeclared-file/forged-signature refusal, missing signing key
refusal, marker ordering, staging containment, drill parameters, SSH argv).
