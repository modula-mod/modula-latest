# Modula GreenField — V1-CLOSEOUT-FINAL-R2

Decision date: 2026-10-16

## Owner decision and acceptance boundary

The owner has explicitly deferred independent off-host backup storage to a
later operations phase. This changes the GreenField v1 acceptance target; it
does not change the recovery facts. The retained R1 evidence proves same-host,
zero-state restoration but does not prove survival of total VPS loss.

GreenField v1 technical acceptance therefore requires:

- a verified pre-deploy and post-deploy backup on the VPS;
- a clean, isolated PostgreSQL restore on the VPS;
- isolated API and worker boot against the restored state;
- media and immutable-artifact recovery with integrity hashes;
- an operator runbook, retention policy, and future Restic/S3 templates; and
- an explicit `OFF-HOST DISASTER RECOVERY: DEFERRED BY OWNER` statement.

It must not be described as independent host-loss recovery or a full
operational DR freeze.

## Retained candidate evidence

The R1 report and its checksummed evidence remain authoritative for unchanged
source and image inputs:

- 1,800.41-second soak: 178,110 requests at 98.94 RPS; p95 10.85 ms;
  p99 12.62 ms; zero 5xx, timeouts, service loss, database loss, or queue loss.
- Canonical API suite: all 465 cases proven (464 in the pristine suite and the
  one environment-gated case in its required live harness).
- Worker suite: 13 files / 44 tests, including legacy migration cases.
- Local CI-equivalent validation: contract freeze, permission inventory,
  MP02, MD03, API-FIX security, Social, snapshot tests, special-case verifier,
  typecheck, lint, builds, Atlas, secret scan, and nginx verifier all passed.
- Candidate API and worker SBOMs and vulnerability reports are retained with
  verified SHA-256 checksums. No high/critical finding has a published fix;
  the twelve unique OS advisories and their reachability decisions are
  documented in `docs/operations/greenfield-supply-chain.md`.
- Production-shaped restore and `073_backup_sequence_acl_defaults` to
  `074_greenfield_v1_query_indexes` migration rehearsal passed in 0.65 seconds.
  Records, installations, permissions, trust, media, shares, search
  projections, API boot, worker boot, and integrity checks were preserved.

No expensive evidence suite is repeated solely for this acceptance-boundary
change. Any source, dependency, migration, image, or contract change after the
retained evidence invalidates that reuse and requires proportionate reruns.

## Historical terminal jobs

The twelve legacy dead letters remain permanently historical and non-retryable:
six disabled Mail provisioning requests, four retired search-reindex dry-runs,
and two synthetic plugin failure fixtures. Replay remains prohibited.

Immediately before the bounded production transition, the operator must rerun
the dry-run and require count `12` and digest
`f94846d400d7ad45392ef6bb4072f91dfa5271342fd7f86836778b6c484b9668`.
Apply mode may only change those rows from `DEAD_LETTER` to `CANCELLED`, retain
their failure history, and append the documented audit event. Any changed set
is a hard stop. Zero unexplained or actively retrying poison jobs is required;
audit retention does not require deletion of historical rows.

## Completion rule

PR #126 may be made ready and merged after mandatory hosted checks pass. Only
the accepted main SHA may be deployed, and migration 074 may be applied only
after a fresh verified backup and lock checks. The technical baseline becomes
effective only when post-deploy production acceptance and the final same-host
isolated recovery drill pass and the non-conflicting annotated baseline tag is
created on that deployed main commit.
