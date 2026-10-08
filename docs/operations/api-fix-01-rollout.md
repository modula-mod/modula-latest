# API-FIX-01 rollout and reaction replay

This runbook is gated on a green PR/CI and an accepted merge SHA. Source changes are made on the Mac; the VPS receives only accepted `main`. Do not use the production database for migration experiments.

## Pre-deploy truth

Record `origin/main`, the clean VPS checkout status, the running API and worker image revisions, the fresh worker heartbeat revision, live/ready status, and the migration ledger. The predecessor for API-FIX-01 is migration `065_comments_rich`; the forward migration is `066_trust_privacy_fail_closed`. Stop if runtime or source lineage differs from the approved merge, or if another deployment appeared.

Before applying 066, inspect the established backup command and its retention behavior, use verified backup storage with restricted access, record the backup identifier, verify disk and database health, and inspect the exact migration SQL. `ops/backup/backup-postgres.sh` creates a gzip-compressed dump with SHA-256 verification and prunes backup directories older than 14 days; it does not encrypt the dump. The migration creates `follow_requests`; it does not grant missing module permissions, convert pending requests into follows, or delete notification history.

## Release trust safety gate

The production inventory at the October 7 preflight had 12 published releases, no registered publisher signing keys, and no release signature evidence. They must remain `untrusted` after the policy change. Do not fabricate `signed` metadata or grant users' missing permission reviews. A first-party signing ceremony needs approved private-key custody, per-release canonical artifact/provenance verification, public-key registration, and verification through the existing Ed25519 protocol before any release can be called production-trusted. See `api-fix-01-release-inventory.md` for per-release evidence. If the ceremony is not complete, report the trust rollout as partial and assess installation/enable impact before deploying strict policy.

The retrospective signing path is `POST /v1/admin/registry/releases/:releaseId/signature`, restricted to a registry administrator. Its validated body is `{"signature":{"algorithm":"Ed25519","keyId":"...","value":"..."},"statementSha256":"<64 lowercase hex>"}`. The route independently downloads and verifies the existing GitHub release tag, package and provenance; it then locks the published unsigned release, compares immutable registry/integrity/projection facts to that verified package, rebuilds the canonical statement, verifies the signature against the publisher's registered public key, and records signature and audit evidence in one transaction. An identical retry succeeds without a second row. A conflicting signature, absent provenance, unknown or revoked key, mismatched digest, or superseded legacy release is rejected. The response never includes the signing private key or package bytes. Package blob completeness is reported separately; signing does not create missing blobs.

`fetchVerified` requires `modula.product.json` inside the downloaded package. The inventory proves package/provenance digest matches for all 12 published releases, but four older published rows lack a database MPS projection; that absence does not establish whether their package passes the current verifier. Treat those four as candidates until each passes this route's live package verification. If an installed executable release remains unsigned, strict production deployment remains gated.

The existing publisher-side helper also previews the exact canonical statement bytes. From `services/greenfield-api`, use the independently downloaded package's `module.manifest.json` and package archive, the registered key ID, and the verified release commit:

```sh
pnpm exec tsx scripts/sign-release-statement.ts \
  --key-id '<registered-key-id>' \
  --manifest '<verified-package>/module.manifest.json' \
  --artifact '<verified-release>.tgz' \
  --source-sha '<verified-40-hex-commit>' \
  --print-statement | shasum -a 256
```

Include `--product '<verified-package>/modula.product.json'` and `--frontend '<verified-package>/<frontend-artifact>'` only where those exact bytes have a matching registry MPS/frontend projection; omit each flag when its registry projection is absent. Run the same helper without `--print-statement` and with the publisher-controlled PEM path in `MODULA_PUBLISHER_SIGNING_KEY_FILE` to produce only the public signature object, or sign the previewed bytes in a KMS. The digest from the preview is `statementSha256` in the admin request. A mismatch against the server's independently rebuilt statement is rejected.

The publisher-side `services/greenfield-api/scripts/sign-release-statement.ts` supports an Ed25519 PEM supplied through `MODULA_PUBLISHER_SIGNING_KEY_FILE` or `--print-statement` bytes for a KMS signer. The same canonical statement bytes must yield the supplied `statementSha256`. Register only the public key through `POST /v1/admin/registry/publishers/modula/signing-keys`. At the October 8 read-only custody check, the repository had no GitHub Actions secrets and no publisher signing PEM at the documented example paths on the VPS. Select and establish publisher-owned CI secret or KMS custody before generating signatures; do not put a private key in the API/worker runtime, production database, repository, CI output, or Atlas artifacts. Prepare each signed request from independently verified release assets; record the key fingerprint, statement digest, release ID, verification result and trust state in protected operations evidence. Verify all currently executable published releases before deploying strict trust enforcement.

## Reaction dead-letter replay

At the October 7 read-only preflight, 24 `notification.reaction` jobs were `DEAD_LETTER` with `error_code=23505`; 24 matching failure records remained. Recount immediately before replay. Only replay after the exact aged-aggregation regression and production controlled reaction acceptance pass.

1. Identify candidate job IDs with a read-only query limited to `background_jobs.job_type='notification.reaction'`, `status='DEAD_LETTER'`, `dispatch_mode='GREENFIELD_WORKER'`, and `error_code='23505'`. Confirm the latest matching `job_failures` record has PostgreSQL `23505` for the exact `notifications_recipient_dedupe_uidx` constraint; another unique violation is not eligible. Preserve the sanitized ID/count/failure evidence in protected operations evidence; never export job payloads or credentials.
2. Through a protected `admin:ops` session, invoke `POST /v1/admin/ops/jobs/reaction-dead-letters/:jobId/retry` once per candidate with an operator reason in the validated JSON body. The route validates the ID and, under a row lock, requeues only the affected job. It preserves historical `job_failures`, writes a request-correlated audit event, resets the attempt budget, and lets the ordinary worker claim the original job and payload. It cannot replay unrelated or already-replayed jobs.
3. Observe each job reaching `SUCCEEDED` through normal worker processing. Recount matching dead letters, inspect new `job_failures`, and verify notification aggregation and unique-key consistency. A job that fails again is investigated; do not manually mark it successful or delete its failure evidence.

## Acceptance and closeout

Run the current API Atlas public probes, complete authenticated acceptance, and expanded cross-user matrix using the protected audit identities. Exercise owned/foreign installation and AI stream paths, unreviewed/granted/denied module permissions, signed/unsigned release fixtures, pending/accept/reject/cancel/block follow transitions, and normal plus historical reaction notification behavior. Capture cleanup dispositions. Only then regenerate the production Atlas from the deployed SHA and record image IDs, migration, worker heartbeat, and deployment lineage. Seven gaps may be marked production-fixed only when every corresponding production check passes.
