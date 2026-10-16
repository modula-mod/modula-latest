# GreenField v1 technical baseline

Baseline name: `greenfield-v1-technical-baseline`

This document is a versioned acceptance contract. It becomes an effective
baseline only when the identically named annotated Git tag is created on the
same accepted main commit after production deployment and final recovery pass.
The tag annotation records the immutable PR, merge, deployment, migration,
backup, restore, image, and CI identities. Absence of that tag means the
declaration below is not yet effective.

## Effective declaration

When the tag exists on the deployed commit:

- `GREENFIELD V1 TECHNICAL STATUS: PASS`
- `PRODUCTION DEPLOYMENT: PASS`
- `NATIVE CONTRACT HANDOFF: APPROVED`
- `SAME-HOST RECOVERY: PASS`
- `OFF-HOST DISASTER RECOVERY: DEFERRED BY OWNER`
- `FULL OPERATIONAL DR FREEZE: PENDING`

## Frozen technical surface

The baseline covers the public GreenField v1 HTTP and error contracts,
identity and account isolation, signed module distribution and installation
descriptors, exact-release permission review, generic records and history,
sync cursors and tombstones, media bindings, record sharing, governed
functions/actions, generic search, intelligence policy, Social contracts, and
the versioned Native handoff fixtures under
`fixtures/greenfield-v1-native/1.0.0`.

Contract evolution remains possible only through an explicit versioned change;
the baseline is not permission to add product-specific server branches or to
weaken trust, permission, privacy, or account boundaries.

## Recovery boundary

The accepted recovery claim is limited to verified encrypted backups stored on
the current VPS, clean same-host PostgreSQL restore, isolated restored API and
worker startup, media recovery, immutable module-artifact recovery, integrity
hashes, and operator runbooks. It does not claim an independent copy or
survival of correlated VPS/storage loss.

Future Restic/S3 work must add independently administered storage, encrypted
replication, retrieval, clean restore, credential rotation, retention testing,
and total-host-loss rehearsal before `FULL OPERATIONAL DR FREEZE` can pass.
