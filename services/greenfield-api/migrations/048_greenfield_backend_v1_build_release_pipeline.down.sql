DROP TABLE IF EXISTS greenfield_release_review_checks;
DROP TABLE IF EXISTS greenfield_build_result_receipts;
DROP TABLE IF EXISTS greenfield_build_claim_requests;
DROP TABLE IF EXISTS greenfield_build_provenance;
DROP TABLE IF EXISTS greenfield_build_service_registrations;
DROP INDEX IF EXISTS greenfield_developer_builds_claim_idx;
DROP INDEX IF EXISTS greenfield_developer_builds_idempotency_idx;
UPDATE greenfield_developer_builds SET state='FAILED' WHERE state='QUARANTINED';
ALTER TABLE greenfield_developer_builds DROP CONSTRAINT greenfield_developer_builds_state_check;
ALTER TABLE greenfield_developer_builds ADD CONSTRAINT greenfield_developer_builds_state_check
  CHECK (state IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED'));
ALTER TABLE greenfield_developer_builds
  DROP COLUMN IF EXISTS provenance_signature,
  DROP COLUMN IF EXISTS licence_inventory_ref,
  DROP COLUMN IF EXISTS sbom_sha256,
  DROP COLUMN IF EXISTS manifest_sha256,
  DROP COLUMN IF EXISTS failure_summary,
  DROP COLUMN IF EXISTS failure_code,
  DROP COLUMN IF EXISTS lease_expires_at,
  DROP COLUMN IF EXISTS lease_owner,
  DROP COLUMN IF EXISTS maximum_attempts,
  DROP COLUMN IF EXISTS attempt_count,
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS request_id;
UPDATE schema_metadata SET value='047', updated_at=NOW() WHERE key='schema_version';
