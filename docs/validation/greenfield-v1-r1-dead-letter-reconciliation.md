# GreenField v1 R1 legacy dead-letter reconciliation

Date: 2026-10-15

Production was inspected read-only at SHA
`f05d03c237c62d1b0946a760610d1155f02a8520` and migration
`073_backup_sequence_acl_defaults`. Payload bodies and user identifiers were not
exported. Job identifiers in the operator inspection were represented only by
one-way hashes.

## Candidate set

The bounded closeout tool selected exactly 12 terminal jobs:

| Job type | Count | Original terminal result | Current side-effect state | Disposition |
| --- | ---: | --- | --- | --- |
| `plugin.enable` | 2 | Permanent `42P18` / `LEGACY_JOB_FAILURE` | Both target installations now exist. One payload explicitly requested simulated failure and the other simulated timeout. Neither job has a result reference. | Do not replay. Cancel as obsolete synthetic failure evidence. |
| `search.reindex` | 4 | Permanent `UNSUPPORTED_RECORD_TYPE` / `LEGACY_JOB_FAILURE` | All four requests are dry-runs and their reindex request rows remain terminal. The historical handler is not a current authoritative write path. | Do not replay. Cancel as obsolete dry-run evidence; use the current reindex runbook for any new rebuild. |
| `mail.identity.provision` | 6 | Permanent `MAIL_PROVISIONER_DISABLED` / `LEGACY_JOB_FAILURE` | All six mail identities remain queued. Mail provisioning is intentionally disabled and is not a GreenField v1 freeze capability. | Do not replay. Retain identity state and create a fresh governed request only in a future Mail phase. |

All 12 jobs have no active lease and no result reference. Their deterministic
candidate-set digest is:

```text
f94846d400d7ad45392ef6bb4072f91dfa5271342fd7f86836778b6c484b9668
```

The dry-run command returned:

```json
{"mode":"dry-run","count":12,"digest":"f94846d400d7ad45392ef6bb4072f91dfa5271342fd7f86836778b6c484b9668","classes":{"mail.identity.provision":6,"plugin.enable":2,"search.reindex":4}}
```

## Replay and transition decision

Replay is rejected for every class: the plugin jobs are intentional failure
fixtures, the search jobs are dry-runs for a retired handler, and Mail remains
disabled. Replaying any class would add risk without recovering an intended
irreversible side effect.

`closeout-terminal-jobs.ts` provides a transactionally bounded transition from
`DEAD_LETTER` to `CANCELLED`. Apply mode requires the exact count and digest
from a fresh dry-run, locks the selected rows, retains failure history, and
appends one audit event. This exact transition was already rehearsed against a
clean restored production copy, where it changed only the 12 rows, created one
audit event, and left all 25 integrity checks passing.

The production transition is deliberately deferred while the mandatory
independent off-host recovery destination is unavailable. Production therefore
still contains 12 active historical dead letters. After off-host replication
and retrieval are proven, rerun the dry-run, require the same count and digest,
apply once, and re-run the integrity and dead-letter checks. A changed candidate
set is a hard stop.

## Operator authority

- Dry-run is always the default.
- Apply requires both `--expected-count 12` and the exact digest above.
- No payload is rewritten or deleted.
- No current permission, trust, or release check is bypassed.
- Mail provisioning is not activated by this reconciliation.
- The audit event is `operations.greenfield_v1.terminal_jobs_cancelled`.
