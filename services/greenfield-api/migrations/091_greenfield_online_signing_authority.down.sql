UPDATE background_jobs SET status = 'CANCELLED', updated_at = NOW()
  WHERE job_type = 'publisher.release-job.sign' AND status IN ('QUEUED', 'RETRYING', 'LEASED', 'RUNNING');
UPDATE greenfield_publisher_release_jobs SET state = 'failed', error = '{"code":"SIGNING_FAILED","message":"Online signing migration rolled back"}'::jsonb,
  updated_at = NOW() WHERE state IN ('ready_for_signing', 'signing', 'signing_failed');
UPDATE greenfield_publisher_release_jobs SET cancelled_from_state = 'failed', updated_at = NOW()
  WHERE state = 'cancelled' AND cancelled_from_state IN ('ready_for_signing', 'signing', 'signing_failed');

DROP INDEX IF EXISTS greenfield_publisher_release_jobs_signing_idempotency_idx;
DROP INDEX IF EXISTS greenfield_publisher_release_jobs_inflight_tag_idx;
DROP INDEX IF EXISTS greenfield_publisher_release_jobs_inflight_version_idx;
ALTER TABLE greenfield_publisher_release_jobs DROP CONSTRAINT IF EXISTS greenfield_publisher_release_jobs_receipt_fields_check;
ALTER TABLE greenfield_publisher_release_jobs DROP CONSTRAINT IF EXISTS greenfield_publisher_release_jobs_approval_check;
ALTER TABLE greenfield_publisher_release_jobs DROP CONSTRAINT IF EXISTS greenfield_publisher_release_jobs_cancelled_from_state_check;
ALTER TABLE greenfield_publisher_release_jobs DROP CONSTRAINT IF EXISTS greenfield_publisher_release_jobs_state_check;
ALTER TABLE greenfield_publisher_release_jobs ADD CONSTRAINT greenfield_publisher_release_jobs_state_check CHECK (state IN (
  'created', 'fetching', 'validating', 'signature_missing', 'signature_invalid', 'signature_verified',
  'validation_failed', 'ready_for_review', 'publishing', 'published', 'cancelled', 'failed', 'conflicted'
));
ALTER TABLE greenfield_publisher_release_jobs ADD CONSTRAINT greenfield_publisher_release_jobs_cancelled_from_state_check CHECK (cancelled_from_state IS NULL OR cancelled_from_state IN (
  'created', 'fetching', 'validating', 'signature_verified', 'ready_for_review', 'publishing',
  'signature_missing', 'signature_invalid', 'validation_failed', 'failed'
));
ALTER TABLE greenfield_publisher_release_jobs
  DROP COLUMN IF EXISTS signing_receipt,
  DROP COLUMN IF EXISTS signed_at,
  DROP COLUMN IF EXISTS signing_started_at,
  DROP COLUMN IF EXISTS signing_identity_id,
  DROP COLUMN IF EXISTS sign_requested_by_account_id,
  DROP COLUMN IF EXISTS signing_idempotency_key,
  DROP COLUMN IF EXISTS signing_request_id,
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS approval_sha256,
  DROP COLUMN IF EXISTS approved_facts;
CREATE UNIQUE INDEX greenfield_publisher_release_jobs_inflight_tag_idx
  ON greenfield_publisher_release_jobs (module_id, release_tag)
  WHERE state IN ('created', 'fetching', 'validating', 'signature_verified', 'ready_for_review', 'publishing');
CREATE UNIQUE INDEX greenfield_publisher_release_jobs_inflight_version_idx
  ON greenfield_publisher_release_jobs (module_id, version)
  WHERE version IS NOT NULL AND state IN ('created', 'fetching', 'validating', 'signature_verified', 'ready_for_review', 'publishing');

DROP TABLE IF EXISTS greenfield_publisher_signing_audit_events;
DROP FUNCTION IF EXISTS greenfield_publisher_signing_audit_append_only();
DROP TABLE IF EXISTS greenfield_publisher_signing_authorizations;
DROP TABLE IF EXISTS greenfield_publisher_online_signing_identities;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '090')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
