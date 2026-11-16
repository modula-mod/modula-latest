DROP TRIGGER IF EXISTS greenfield_publisher_release_immutable_facts_guard ON greenfield_module_releases;
DROP FUNCTION IF EXISTS greenfield_publisher_release_immutable_facts_guard();
DROP TRIGGER IF EXISTS greenfield_publisher_signature_evidence_guard ON greenfield_module_release_signatures;
DROP FUNCTION IF EXISTS greenfield_publisher_signature_evidence_guard();
DROP TRIGGER IF EXISTS greenfield_publisher_release_authority_guard ON greenfield_publisher_release_jobs;
DROP FUNCTION IF EXISTS greenfield_publisher_release_authority_guard();

DROP FUNCTION IF EXISTS greenfield_publication_authority_publish_next();
DROP FUNCTION IF EXISTS greenfield_publication_authority_publish(TEXT);
DROP FUNCTION IF EXISTS greenfield_trust_verifier_record(TEXT, TEXT, BOOLEAN, TEXT, TEXT);
DROP FUNCTION IF EXISTS greenfield_trust_verifier_claim(TEXT);
DROP FUNCTION IF EXISTS greenfield_signing_runner_fail(TEXT, TEXT);
DROP FUNCTION IF EXISTS greenfield_signing_runner_submit_signature(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS greenfield_signing_runner_claim(TEXT, INTEGER);
DROP FUNCTION IF EXISTS greenfield_release_approver_invalidate(TEXT, TEXT);
DROP FUNCTION IF EXISTS greenfield_release_approver_record(TEXT, TEXT);

DROP TRIGGER IF EXISTS greenfield_publisher_release_claim_must_be_consumed
  ON greenfield_publisher_release_signing_claims;
DROP FUNCTION IF EXISTS greenfield_publisher_release_claim_must_be_consumed();
DROP FUNCTION IF EXISTS greenfield_publisher_release_approved_facts_match(TEXT);
DROP FUNCTION IF EXISTS greenfield_publisher_authority_actor(TEXT);
DROP FUNCTION IF EXISTS greenfield_publisher_authority_has(TEXT);

DROP TABLE IF EXISTS greenfield_publisher_release_signing_claims;
DROP TABLE IF EXISTS greenfield_publisher_release_authority_principals;

ALTER TABLE greenfield_publisher_signing_audit_events
  DROP COLUMN IF EXISTS actor_database_role;

UPDATE greenfield_publisher_release_jobs
SET state = CASE
  WHEN state = 'awaiting_approval' THEN 'validation_failed'
  WHEN state = 'signature_pending_verification' THEN 'signing_failed'
  ELSE state
END,
cancelled_from_state = CASE
  WHEN cancelled_from_state = 'awaiting_approval' THEN 'validation_failed'
  WHEN cancelled_from_state = 'signature_pending_verification' THEN 'signing_failed'
  ELSE cancelled_from_state
END
WHERE state IN ('awaiting_approval', 'signature_pending_verification')
   OR cancelled_from_state IN ('awaiting_approval', 'signature_pending_verification');

ALTER TABLE greenfield_publisher_release_jobs
  DROP CONSTRAINT IF EXISTS greenfield_publisher_release_jobs_candidate_check,
  DROP CONSTRAINT IF EXISTS greenfield_publisher_release_jobs_independent_approver_check,
  DROP CONSTRAINT IF EXISTS greenfield_publisher_release_jobs_requester_approver_check,
  DROP CONSTRAINT IF EXISTS greenfield_publisher_release_jobs_publication_authority_check,
  DROP CONSTRAINT IF EXISTS greenfield_publisher_release_jobs_approval_check,
  DROP CONSTRAINT IF EXISTS greenfield_publisher_release_jobs_state_check,
  DROP CONSTRAINT IF EXISTS greenfield_publisher_release_jobs_cancelled_from_state_check;

ALTER TABLE greenfield_publisher_release_jobs
  ADD CONSTRAINT greenfield_publisher_release_jobs_state_check CHECK (state IN (
    'created', 'fetching', 'validating', 'signature_missing', 'signature_invalid',
    'ready_for_signing', 'signing', 'signature_verified', 'signing_failed',
    'validation_failed', 'ready_for_review', 'publishing', 'published',
    'cancelled', 'failed', 'conflicted'
  )),
  ADD CONSTRAINT greenfield_publisher_release_jobs_cancelled_from_state_check CHECK (
    cancelled_from_state IS NULL OR cancelled_from_state IN (
      'created', 'fetching', 'validating', 'signature_verified',
      'ready_for_signing', 'signing', 'signing_failed', 'ready_for_review',
      'publishing', 'signature_missing', 'signature_invalid',
      'validation_failed', 'failed'
    )
  ),
  ADD CONSTRAINT greenfield_publisher_release_jobs_approval_check CHECK (
    (approved_at IS NULL AND approval_sha256 IS NULL AND approved_facts IS NULL)
    OR (approved_at IS NOT NULL AND approval_sha256 IS NOT NULL AND approved_facts IS NOT NULL)
  );

ALTER TABLE greenfield_publisher_release_jobs
  DROP COLUMN IF EXISTS approval_candidate_facts,
  DROP COLUMN IF EXISTS approval_candidate_sha256,
  DROP COLUMN IF EXISTS approval_candidate_at,
  DROP COLUMN IF EXISTS approved_by_account_id,
  DROP COLUMN IF EXISTS approval_invalidated_at,
  DROP COLUMN IF EXISTS approval_invalidated_by_account_id,
  DROP COLUMN IF EXISTS approval_invalidation_reason,
  DROP COLUMN IF EXISTS publication_authorized_by_account_id,
  DROP COLUMN IF EXISTS publication_authorized_at;

DROP INDEX IF EXISTS greenfield_publisher_release_jobs_inflight_tag_idx;
DROP INDEX IF EXISTS greenfield_publisher_release_jobs_inflight_version_idx;
CREATE UNIQUE INDEX greenfield_publisher_release_jobs_inflight_tag_idx
  ON greenfield_publisher_release_jobs (module_id, release_tag)
  WHERE state IN (
    'created', 'fetching', 'validating', 'ready_for_signing', 'signing',
    'signature_verified', 'ready_for_review', 'publishing'
  );
CREATE UNIQUE INDEX greenfield_publisher_release_jobs_inflight_version_idx
  ON greenfield_publisher_release_jobs (module_id, version)
  WHERE version IS NOT NULL AND state IN (
    'created', 'fetching', 'validating', 'ready_for_signing', 'signing',
    'signature_verified', 'ready_for_review', 'publishing'
  );

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '091')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = pg_catalog.clock_timestamp();
