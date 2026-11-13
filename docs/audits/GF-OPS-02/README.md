# GF-OPS-02 - off-host encrypted backup copy and restore drill (local evidence)

Base: modula-latest main `a91d490e61ebfff38069378ddf757429eb000449` (tip `090_calls_v1`).
Author: SENTINEL. This is author evidence, not certification, and not production acceptance.

## What was exercised (2026-11-13 12:09-12:10 GMT, `local-drill.sh`)

All on loopback PostgreSQL `127.0.0.1:55491`, disposable databases created and
dropped by the script; synthetic `test.modula.*` data only; off-host = a local
directory standing in for the remote (`file://` transport).

| Step | Result |
|---|---|
| Source DB migrated 001..090 with the real `migrate.ts` runner | 90 applied |
| Fixture: 5,000 rows + bytea, 2 heartbeat rows, nested media (200 KB blob) | seeded |
| `greenfield-backend-v1-recovery.mjs backup` + `verify` | ok, 2 payloads, coverage schemaVersion 090 |
| Off-host push with `MODULA_OFFHOST_BACKUP_ENABLED` unset | skipped, nothing written |
| Off-host push `--dry-run` | validated 5 files / 1,906,684 bytes, nothing written |
| Off-host push + list | committed, receipt written last, set listed |
| Off-host copy grepped for fixture plaintext | none found |
| On-host set deleted (host loss), `greenfield-v1-restore-drill.mjs` from off-host into empty `*_restore_*` DB + empty media dir, `--compare-url-env` source | 19/19 checks PASS (`local-restore-drill-report.json`): signature valid; schema 090; 8 inventory counts; ledger 90/90 pending 0 unknown 0; 381 tables / 5,715 rows equal; per-table content digests equal; 2,882 role grants equal; media sha256 identical |
| One byte of off-host ciphertext flipped, drill re-run into a second empty DB | fails closed (`payload checksum mismatch`), target DB left with 0 tables (`local-tamper-drill-report.json`) |

## Limits of this evidence

- **Encryption was a test stub, not age.** The `age` binary is not installed
  on the SENTINEL box and was not fetched (no new tooling without approval).
  The drill put a stub `age`/`age-keygen` (AES-256-GCM keyed from the
  recipient string; writes the real age header) first on `PATH` so the real
  recovery tool ran end to end. This proves the copy/pull/verify/restore
  plumbing and the off-host tool's checks, not age cryptography. The existing
  canonical test `pnpm verify:greenfield-backend-v1:recovery` already requires
  the real `age`; rerun this drill with real `age` before closing the SPOF row.
- `ssh://` transport (rsync over ssh) is covered only by argv tests; no SSH
  destination was contacted.
- The `greenfield-v1-backup.mjs` integration (`copyOffHost`) needs production
  containers and a production checkout; it was syntax-checked and reviewed,
  not executed.
- No production destination, key or setting was configured or touched.
