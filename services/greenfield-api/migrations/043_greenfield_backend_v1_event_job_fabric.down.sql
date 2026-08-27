REVOKE SELECT ON background_jobs, job_failures, greenfield_domain_events FROM modula_backup;

ALTER TABLE job_failures
  DROP CONSTRAINT IF EXISTS job_failures_payload_redacted_check,
  DROP CONSTRAINT IF EXISTS job_failures_payload_fingerprint_check,
  ALTER COLUMN payload DROP DEFAULT,
  DROP COLUMN IF EXISTS error_class,
  DROP COLUMN IF EXISTS payload_fingerprint;

DROP TRIGGER IF EXISTS background_jobs_scope_guard ON background_jobs;
DROP FUNCTION IF EXISTS greenfield_job_scope_guard();
DROP INDEX IF EXISTS background_jobs_service_idempotency_idx;
DROP INDEX IF EXISTS background_jobs_scope_idx;
DROP INDEX IF EXISTS background_jobs_lease_idx;
DROP INDEX IF EXISTS background_jobs_claim_idx;

ALTER TABLE background_jobs DROP CONSTRAINT IF EXISTS background_jobs_status_check;
UPDATE background_jobs
SET status = CASE status
  WHEN 'QUEUED' THEN 'pending'
  WHEN 'LEASED' THEN 'pending'
  WHEN 'RUNNING' THEN 'pending'
  WHEN 'RETRYING' THEN 'pending'
  WHEN 'SUCCEEDED' THEN 'completed'
  WHEN 'FAILED' THEN 'failed'
  WHEN 'CANCELLED' THEN 'failed'
  WHEN 'DEAD_LETTER' THEN 'dead_letter'
  ELSE status
END;
ALTER TABLE background_jobs
  ADD CONSTRAINT background_jobs_status_check
  CHECK (status IN ('pending','leased','completed','failed','dead_letter')),
  DROP COLUMN IF EXISTS error_code,
  DROP COLUMN IF EXISTS error_class,
  DROP COLUMN IF EXISTS result_reference,
  DROP COLUMN IF EXISTS finished_at,
  DROP COLUMN IF EXISTS started_at,
  DROP COLUMN IF EXISTS trace_id,
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS timeout_ms,
  DROP COLUMN IF EXISTS dispatch_mode,
  DROP COLUMN IF EXISTS service_id,
  DROP COLUMN IF EXISTS action,
  DROP COLUMN IF EXISTS release_id,
  DROP COLUMN IF EXISTS installation_id,
  DROP COLUMN IF EXISTS product_id,
  DROP COLUMN IF EXISTS owner_account_id,
  DROP COLUMN IF EXISTS owner_id,
  DROP COLUMN IF EXISTS owner_type;
CREATE INDEX background_jobs_claim_idx ON background_jobs(status, available_at, priority, created_at)
  WHERE status = 'pending';
CREATE INDEX background_jobs_lease_idx ON background_jobs(lease_owner, lease_expires_at)
  WHERE status = 'leased';

DROP TRIGGER IF EXISTS greenfield_domain_events_scope_guard ON greenfield_domain_events;
DROP FUNCTION IF EXISTS greenfield_event_scope_guard();
DROP INDEX IF EXISTS greenfield_domain_events_trace_idx;
DROP INDEX IF EXISTS greenfield_domain_events_product_idx;
DROP INDEX IF EXISTS greenfield_domain_events_producer_idx;
ALTER TABLE greenfield_domain_events
  DROP COLUMN IF EXISTS trace_id,
  DROP COLUMN IF EXISTS release_id,
  DROP COLUMN IF EXISTS installation_id,
  DROP COLUMN IF EXISTS product_id,
  DROP COLUMN IF EXISTS producer_id,
  DROP COLUMN IF EXISTS producer_kind;

UPDATE schema_metadata SET value='042', updated_at=NOW() WHERE key='schema_version';
