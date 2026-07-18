# Phase 6S - Isolated backup restoration

**Date recorded:** 2026-07-18
**Branch:** `phase6s-social-product-completion`
**Product API:** `https://api.modula.digital`
**Status:** **PASS** - restored into an isolated PostgreSQL target only.

## Safety controls

- The active production database was not used as a restore target.
- The restore ran in an isolated Docker PostgreSQL container and isolated Docker network.
- No database passwords, invite codes, verification tokens, recovery tokens, access tokens, or refresh tokens are recorded here.
- The temporary backup file was deleted after evidence was captured.
- AT Protocol remained optional/disabled for the restore API smoke.
- DIMON remained inactive.

## Procedure

1. Created a fresh custom-format PostgreSQL backup from the active production database.
2. Recorded the backup size and SHA-256 checksum.
3. Created a separate PostgreSQL restore container and database.
4. Created local placeholder database roles required by restored privileges.
5. Restored the backup with `pg_restore --exit-on-error`.
6. Ran migration status and migrate checks against the restored target.
7. Verified account, post, reaction, comment, hash-chain, checkpoint, and extension state.
8. Started Greenfield API against the restored database on a local-only port.
9. Ran API smoke tests against the restored API.
10. Destroyed the restore API container, restore DB container, restore network, and temporary backup file.

## Backup Evidence

| Field | Value |
| --- | --- |
| Backup timestamp | `20260718T105259Z` |
| Backup size | `273791 bytes` |
| Checksum (SHA-256) | `a831db9ed6f2e75e296cbeb206ebc7187669045eee8152adaa86b6ed7a37ffca` |
| Restore target | isolated Docker PostgreSQL database `modula_restore` |
| Restore API | isolated Greenfield API on `http://127.0.0.1:4920` |
| Restore cleanup | PASS - restore containers, network, and backup file removed |

## Migration Evidence

| Check | Result |
| --- | --- |
| Restore `db:status` before migrate | PASS - applied `001` through `008`, pending `[]` |
| Restore `db:migrate` | PASS - `{"applied":[]}` |
| Restore `db:status` after migrate | PASS - applied `001` through `008`, pending `[]` |

## Restored Data Counts

| Count | Value |
| --- | ---: |
| Accounts | 10 |
| Auth identities | 9 |
| Actors | 6 |
| Posts | 17 |
| Public posts | 15 |
| Deleted posts | 1 |
| Comments | 13 |
| Active comments | 10 |
| Deleted comment tombstones | 3 |
| Reactions | 5 |
| Active saves | 5 |
| Appearance rows | 10 |
| Function jobs | 19 |
| Extension installations | 6 |
| Extension failures | 3 |

## Integrity Checks

| Check | Result |
| --- | --- |
| Accounts without appearance defaults | PASS - 0 |
| Duplicate reaction rows | PASS - 0 |
| Duplicate active save rows | PASS - 0 |
| Duplicate active repost rows | PASS - 0 |
| Like counter mismatches | PASS - 0 |
| Reaction counter mismatches | PASS - 0 |
| Repost counter mismatches | PASS - 0 |
| Quote counter mismatches | PASS - 0 |
| Post active reply counter mismatches | PASS - 0 |
| Comment active reply counter mismatches | PASS - 0 |
| Event hash-chain rows | PASS - 11 rows |
| Missing previous event hashes | PASS - 0 |
| Duplicate event hashes | PASS - 0 |
| Repository head mismatches | PASS - 0 |
| Checkpoint table verification | PASS - schema present, 0 checkpoint rows, 0 orphaned checkpoints, 0 missing checkpoint heads |
| Extension catalogue rows | PASS - 9 |
| DIMON catalogue status | PASS - `inactive` |
| AT Protocol catalogue status | PASS - `disabled` |
| Extension installation states | PASS - enabled 1, disabled 1, failed 1, uninstalled 3 |

## Restore API Smoke

The restored API was started against the isolated database only. It reported Greenfield preview behavior at `/v1/meta` with AT Protocol disabled/optional and invite-only disabled for the isolated smoke environment.

| Smoke check | Result |
| --- | --- |
| Register | PASS - account created on isolated restore target |
| Verify | PASS |
| Sign in | PASS |
| Appearance patch | PASS - version advanced to 2 |
| Create post | PASS |
| React | PASS |
| Comment | PASS |
| Extension install/enable | PASS |
| Function invoke | PASS - completed |

## Cleanup Evidence

Final cleanup check returned no matching restore containers, no matching restore networks, and no remaining backup files under `/tmp/modula-phase6s-*.dump`.

## Notes

- Checkpoint tables exist in this branch, but the restored production data did not contain checkpoint producer rows at verification time.
- Role creation in the restore target used local placeholders only; no production database credentials are documented.
