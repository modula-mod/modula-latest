# API-FIX-01 rollout and reaction replay

This runbook is gated on a green PR/CI and an accepted merge SHA. Source changes are made on the Mac; the VPS receives only accepted `main`. Do not use the production database for migration experiments.

## Pre-deploy truth

Record `origin/main`, the clean VPS checkout status, the running API and worker image revisions, the fresh worker heartbeat revision, live/ready status, and the migration ledger. The predecessor for API-FIX-01 is migration `065_comments_rich`; the forward migration is `066_trust_privacy_fail_closed`. Stop if runtime or source lineage differs from the approved merge, or if another deployment appeared.

Before applying 066, use the existing encrypted/verified backup procedure under `ops/backup/`, record its identifier, verify disk and database health, and inspect the exact migration SQL. The migration creates `follow_requests`; it does not grant missing module permissions, convert pending requests into follows, or delete notification history.

## Release trust safety gate

The production inventory at the October 7 preflight had 12 published releases, no registered publisher signing keys, and no release signature evidence. They must remain `untrusted` after the policy change. Do not fabricate `signed` metadata or grant users' missing permission reviews. A first-party signing ceremony needs approved private-key custody, per-release canonical artifact/provenance verification, public-key registration, and verification through the existing Ed25519 protocol before any release can be called production-trusted. See `api-fix-01-release-inventory.md` for per-release evidence. If the ceremony is not complete, report the trust rollout as partial and assess installation/enable impact before deploying strict policy.

## Reaction dead-letter replay

At the October 7 read-only preflight, 24 `notification.reaction` jobs were `DEAD_LETTER` with `error_code=23505`; 24 matching failure records remained. Recount immediately before replay. Only replay after the exact aged-aggregation regression and production controlled reaction acceptance pass.

1. Identify candidate job IDs with a read-only query limited to `background_jobs.job_type='notification.reaction'`, `status='DEAD_LETTER'`, `dispatch_mode='GREENFIELD_WORKER'`, and `error_code='23505'`. Confirm the latest matching `job_failures` record has PostgreSQL `23505` for the exact `notifications_recipient_dedupe_uidx` constraint; another unique violation is not eligible. Preserve the sanitized ID/count/failure evidence in protected operations evidence; never export job payloads or credentials.
2. Through a protected `admin:ops` session, invoke `POST /v1/admin/ops/jobs/reaction-dead-letters/:jobId/retry` once per candidate with an operator reason in the validated JSON body. The route validates the ID and, under a row lock, requeues only the affected job. It preserves historical `job_failures`, writes a request-correlated audit event, resets the attempt budget, and lets the ordinary worker claim the original job and payload. It cannot replay unrelated or already-replayed jobs.
3. Observe each job reaching `SUCCEEDED` through normal worker processing. Recount matching dead letters, inspect new `job_failures`, and verify notification aggregation and unique-key consistency. A job that fails again is investigated; do not manually mark it successful or delete its failure evidence.

## Acceptance and closeout

Run the current API Atlas public probes, complete authenticated acceptance, and expanded cross-user matrix using the protected audit identities. Exercise owned/foreign installation and AI stream paths, unreviewed/granted/denied module permissions, signed/unsigned release fixtures, pending/accept/reject/cancel/block follow transitions, and normal plus historical reaction notification behavior. Capture cleanup dispositions. Only then regenerate the production Atlas from the deployed SHA and record image IDs, migration, worker heartbeat, and deployment lineage. Seven gaps may be marked production-fixed only when every corresponding production check passes.
