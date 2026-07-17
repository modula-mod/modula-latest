# PostgreSQL restore (Phase 5)

## Policy
- Daily logical backup
- Weekly isolated restore test
- Monthly retained copy
- Off-server upload deferred until destination/credentials approved

## RPO / RTO
- RPO: 24 hours (daily logical)
- RTO: under 60 minutes for preview database restore on the same VPS

## Encryption-key custody
- Local backups are checksummed; off-server encryption keys are not provisioned in Phase 5.

## Restore steps
1. Choose backup directory under `/home/andrei/backups/modula-postgres/<stamp>/`
2. `ops/backup/verify-backup.sh <dir>`
3. Point `MODULA_RESTORE_TEST_DATABASE_URL` at an isolated database
4. `ops/backup/restore-test.sh <dir>`
5. Run API readiness against the restored database before cutover

## Backup deletion
- Local daily backups older than 14 days are pruned by `backup-postgres.sh`
