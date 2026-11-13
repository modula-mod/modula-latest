# GreenField online publisher signing

Status: local implementation and rollout design only. Nothing in this document authorizes production deployment, key creation, database writes, release publication or feature enablement.

## Reused security boundaries

GREENFIELD-SIGNER-01 extends, rather than replaces, the existing publisher release system:

- `modula.publisher-release.v1`, canonical JSON, the registry-owned statement builder and Ed25519 verification remain unchanged.
- `greenfield_publisher_signing_keys`, key events, release-signature rows and signing-key revocations remain the authoritative public-key trust system.
- the Publisher Release Console ownership checks, release jobs, `background_jobs` queue and dedicated publisher runner remain the only online workflow.
- GitHub release provenance, package digest validation, manifest validation, MPS ingestion, permission deltas and immutable release uniqueness remain mandatory.
- Developer Programme profiles, memberships, publisher owners, developer products, source connections and verified namespace rows are reused as independent authorization facts.

The audit also closed a privilege-escalation path: a manifest can no longer create or elevate a verified first-party publisher or claim a reserved namespace. First-party status and reserved namespaces must already be verified in registry policy.

## Architecture and trust model

The API approves only an existing validated release job. It never accepts bytes, a digest, a provider key reference or a key ID from a builder. The worker refetches the immutable release, reconstructs all statement facts, resolves exactly one publisher-scoped identity from PostgreSQL policy and asks the provider to sign the existing v1 statement bytes. It then verifies the result twice: once through the provider public key and once through the registry public-key service. Only the latter verified result is ingested and made ready for publication.

The statement binds publisher ID, product/module ID, version, source repository and SHA, release tag, artifact checksum, adapter-manifest checksum, product-manifest checksum, frontend checksum and registry-authorized signing key ID. Approval uses the same facts without a key ID. Changing any fact after approval changes the approval digest and requires complete revalidation.

PostgreSQL stores only public keys, provider references, validity policy, grants, receipts and audit facts. Vault stores the private Ed25519 material. Private material must never enter PostgreSQL, source control, container images, application logs or API responses.

Each publisher has a separate provider key and active registry identity. Modula first-party signing uses a distinct `MODULA_FIRST_PARTY` identity and requires all of the following independently:

- a verified, active `firstParty` publisher;
- authoritative verified ownership of the reserved namespace;
- a first-party-authorized builder grant for the exact product;
- a first-party-authorized online identity backed by the distinct Modula key.

Publisher ownership alone is never first-party authority.

## Production provider design

The production implementation is HashiCorp Vault Transit with a non-exportable Ed25519 key per publisher. Vault should run as an HA cluster on a private network, with integrated storage replication, TLS/mTLS, automatic unseal backed by a separately controlled KMS/HSM, encrypted snapshots and tested disaster recovery. Do not import or copy the existing offline Mac key. Create a new online key for the pilot.

The release worker receives a short-lived renewable Vault workload token through an absolute, memory-backed token file maintained by Vault Agent or the workload platform. No static Vault token is placed in environment variables. The worker policy is limited to read metadata and sign on the single enrolled key paths. A separate human-controlled operator policy owns key creation, rotation and policy removal. The API process does not need network access to Vault.

Supported configuration is disabled by default:

- `MODULA_ONLINE_SIGNING_ENABLED=true`
- `MODULA_SIGNING_PROVIDER=vault-transit`
- `MODULA_SIGNING_VAULT_ADDR=https://private-vault-endpoint`
- `MODULA_SIGNING_VAULT_TOKEN_FILE=/run/secrets/modula-signing-vault-token`
- `MODULA_SIGNING_VAULT_MOUNT=transit` (optional)
- `MODULA_SIGNING_VAULT_NAMESPACE=...` (optional)

The Vault key must be `ed25519`, `exportable=false` and `allow_plaintext_backup=false`. Transit receives base64-encoded canonical statement bytes with `prehashed=false`, producing standard Ed25519 signatures compatible with existing offline releases.

## Enrollment and rotation

Enrollment is an operator action through `PublisherOnlineSigningIdentityService`, not a publisher route. The service verifies the registry operator, publisher purpose and first-party policy, reads the provider public key, registers only its SPKI public half, creates the publisher binding and appends an immutable `identity_registered` event. Identity validity is positive and limited to 397 days. Production policy should normally use a shorter window with alerts at 60, 30, 14 and 7 days.

Rotation creates a new provider key version, registers a new public key ID through the existing rotation chain, atomically rebinds the identity and emits `identity_rotated`. If external rotation succeeds but the registry transaction fails, public-key mismatch makes signing fail closed until an operator repairs or revokes the identity. Old signatures remain evidence and follow the existing observed-at rotation rules.

Suspension immediately removes an identity from resolution without revoking historical signatures. Revocation first revokes the authoritative registry public key and identity, then invokes the provider control. This ordering remains fail-closed during a provider outage. Vault Transit does not provide a safe per-key disable operation, so the operator must also remove that named sign path from the worker policy.

Back up Vault through encrypted, access-controlled integrated-storage snapshots and DR replication. Test restoration into an isolated recovery cluster. PostgreSQL backups preserve public bindings, receipts and audit events but cannot restore signing capability. If Vault key material is unrecoverable, enroll a new key ID, revoke the lost identity and revalidate every not-yet-published release.

## Monitoring and emergency shutdown

Alert on provider unavailability, Vault 403/404/5xx responses, public-key mismatch, expired or near-expiry identities, signing retries, `signing_failed`, approval invalidations, unusual per-actor request volume, attempted arbitrary fields, revoked-key use and publication refusal. Correlate the release job ID, signing request ID, identity ID, statement hash and receipt ID; never log statement payloads, signatures as credentials, Vault tokens or private material.

Emergency shutdown sequence:

1. Disable `MODULA_ONLINE_SIGNING_ENABLED` for API and worker and stop only the publisher signing consumer.
2. Suspend or revoke affected identities and registry public keys.
3. Remove Vault sign capabilities for affected key paths and revoke workload tokens.
4. Leave queued jobs closed; do not convert them to publication jobs.
5. Preserve Vault, database and service audit evidence.
6. Determine the last trusted signature time and affected statement hashes.
7. Rotate to a new key ID, register its public half and revalidate pending releases before resuming.

For confirmed compromise, revoke rather than suspend. Existing release signature rows are retained but become `revokedKey`; no new publication may rely on them. Registry revocation remains authoritative even if Vault is unavailable.

## Feature-flagged rollout

1. Deploy Vault and networking with signing disabled; test HA, snapshot restore, token renewal and emergency policy removal.
2. Apply migration `091_greenfield_online_signing_authority` and verify API, worker, backup and migrator privileges.
3. Create a new, distinct Modula online Ed25519 key; register its public half and first-party policy through two-person operator review.
4. Enable a Modula-only pilot for one non-public release candidate. Keep offline verification compatibility and do not replace the offline key.
5. Review receipts, alerts, latency, retry behavior, revocation drills and audit completeness.
6. Expand to selected third-party publishers with separate Vault keys, exact product grants and expiration dates.
7. Expand generally only after security review, operational acceptance and an emergency shutdown exercise.

Rollback the feature flag before rolling back schema. Migration down cancels pending sign work and converts online-signing states to failed; it never publishes a release.

## Local verification

All database commands must target a disposable PostgreSQL instance.

```sh
CI=true pnpm --filter @modula/greenfield-api... build
```

```sh
CI=true pnpm --filter @modula/greenfield-api exec vitest run tests/publisher-signing-provider.test.ts tests/greenfield-signer.vault-notes-fixture.test.ts
```

```sh
MODULA_TEST_DATABASE_URL=postgresql://... CI=true pnpm --filter @modula/greenfield-api exec vitest run tests/publisher-first-party-policy.test.ts tests/publisher-console.release-jobs.test.ts --maxWorkers=1 --no-file-parallelism
```

```sh
MODULA_TEST_DATABASE_URL=postgresql://... CI=true pnpm --filter @modula/greenfield-api exec tsx scripts/verify-migration-cycle.ts 091_greenfield_online_signing_authority
```

## Vault Notes compatibility fixture

The non-production Vault Notes `2.1.0-rc.4` fixture uses artifact SHA-256 `727c718436f97baf9562d3bc0562c24704362a1962c97704c409f1ecdb7b5aca` and temporary disposable test material. With signing key ID `fixture-vault-notes-online-2026-01`, the canonical `modula.publisher-release.v1` statement SHA-256 is `6995c0114955b13121bd06024dacdb49acee1557d0cd332b08cd7cc4f69a597a`.

That digest changes when the authorized online key ID changes. The fixture signature is not an official Modula signature, is not registered in production and must not be published or substituted for the offline signature.

## GF-SIGN-01: migration number 091 and rollback

PR #165 originally shipped this schema as `089_greenfield_online_signing_authority`, cut from a base before
`089_messaging_v3` and `090_calls_v1` landed on main. The runner (`src/database/migrate.ts`) orders up
migrations by filename and records the file stem in `schema_migrations`; there is no separate registry or
manifest. The only other places that pin migration identity are the ledger tests
(`tests/api-fix-01.migration.test.ts`, `tests/greenfield-backend-v1.migration-ledger-security.test.ts`) and
the generated API atlas. The schema is restaged unchanged as `091_greenfield_online_signing_authority`, which
is the next free number. It writes `schema_version = '091'` and its `.down.sql` restores `'090'`. 091 touches
only publisher signing objects, the `greenfield_publisher_release_jobs` signing columns and constraints, and
`publisher.release-job.sign` background jobs. It touches no messaging (089) or calls (090) objects.

The old id `089_greenfield_online_signing_authority` was never merged to main. A disposable database that
applied it from the #165 branch reports that id as `unknown` in `migrateStatus`. Rebuild that database, or run
the #165 down migration from that branch first. Do not rename a ledger row, and do not add the old id to
`KNOWN_LEGACY_MIGRATIONS` without architecture approval.

Rollback of 091 (staging and disposable databases; production only with owner approval):

1. Roll back the feature first. Set `MODULA_ONLINE_SIGNING_ENABLED=false` for the API and worker, and stop the
   publisher signing consumer.
2. Take a backup before any schema rollback, and keep it with the audit evidence. Use `pg_dump` with `-t` for
   `greenfield_publisher_online_signing_identities`, `greenfield_publisher_signing_authorizations` and
   `greenfield_publisher_signing_audit_events`, plus the signing columns of `greenfield_publisher_release_jobs`.
3. Roll back only while 091 is the ledger tip: `pnpm --filter @modula/greenfield-api db:rollback` runs once
   and removes 091. Never roll back 090 or 089 to reach 091.
4. Verify that `schema_version` is `090`, that `migrateStatus` reports `pending = [091_greenfield_online_signing_authority]`,
   and that the calls and messaging v3 tables are still present.

The `.down.sql` is destructive. It drops the online identities, the authorizations and the append-only signing
audit trail. It drops the release-job approval, request and receipt columns. It cancels queued sign jobs and
moves `ready_for_signing`, `signing` and `signing_failed` jobs to `failed`. It never publishes a release.
Registry public keys, signing-key events and release-signature rows from earlier migrations are retained.
After any real online signature exists, prefer a forward-fix migration. The down migration does not recover
audit facts, and only the backup in step 2 preserves them.
