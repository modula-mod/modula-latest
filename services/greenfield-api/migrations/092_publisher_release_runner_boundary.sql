-- GF-SIGNER-08A-R2: transaction-bound signing runner security boundary.
--
-- The signing runner has no direct table DML. A claim exists only inside the
-- explicit transaction which created it and is identified by PostgreSQL's
-- server-assigned xid8. A deferred constraint refuses commit while a claim is
-- still present, so a pooled connection cannot retain or inherit authority.
-- Approval, signature verification and publication are separate authorities.

CREATE TABLE greenfield_publisher_release_authority_principals (
  database_role NAME NOT NULL,
  authority TEXT NOT NULL CHECK (authority IN (
    'RELEASE_APPROVER',
    'SIGNING_RUNNER',
    'TRUST_VERIFIER',
    'PUBLICATION_AUTHORITY'
  )),
  account_id TEXT REFERENCES greenfield_accounts(account_id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (database_role, authority),
  CHECK ((authority IN ('RELEASE_APPROVER', 'PUBLICATION_AUTHORITY')) = (account_id IS NOT NULL)),
  CHECK ((active AND revoked_at IS NULL) OR (NOT active AND revoked_at IS NOT NULL))
);

REVOKE ALL ON greenfield_publisher_release_authority_principals FROM PUBLIC;

ALTER TABLE greenfield_publisher_release_jobs
  ADD COLUMN approval_candidate_facts JSONB
    CHECK (approval_candidate_facts IS NULL OR (
      pg_catalog.jsonb_typeof(approval_candidate_facts) = 'object'
      AND pg_catalog.strpos(approval_candidate_facts::TEXT, 'PRIVATE KEY') = 0
    )),
  ADD COLUMN approval_candidate_sha256 TEXT
    CHECK (approval_candidate_sha256 IS NULL OR approval_candidate_sha256 ~ '^[0-9a-f]{64}$'),
  ADD COLUMN approval_candidate_at TIMESTAMPTZ,
  ADD COLUMN approved_by_account_id TEXT REFERENCES greenfield_accounts(account_id),
  ADD COLUMN approval_invalidated_at TIMESTAMPTZ,
  ADD COLUMN approval_invalidated_by_account_id TEXT REFERENCES greenfield_accounts(account_id),
  ADD COLUMN approval_invalidation_reason TEXT
    CHECK (approval_invalidation_reason IS NULL OR pg_catalog.length(approval_invalidation_reason) BETWEEN 1 AND 500),
  ADD COLUMN publication_authorized_by_account_id TEXT REFERENCES greenfield_accounts(account_id),
  ADD COLUMN publication_authorized_at TIMESTAMPTZ;

ALTER TABLE greenfield_publisher_release_jobs
  DROP CONSTRAINT IF EXISTS greenfield_publisher_release_jobs_state_check;
ALTER TABLE greenfield_publisher_release_jobs
  ADD CONSTRAINT greenfield_publisher_release_jobs_state_check CHECK (state IN (
    'created', 'fetching', 'validating', 'awaiting_approval',
    'signature_missing', 'signature_invalid', 'ready_for_signing', 'signing',
    'signature_pending_verification', 'signature_verified', 'signing_failed',
    'validation_failed', 'ready_for_review', 'publishing', 'published',
    'cancelled', 'failed', 'conflicted'
  ));

ALTER TABLE greenfield_publisher_release_jobs
  DROP CONSTRAINT IF EXISTS greenfield_publisher_release_jobs_cancelled_from_state_check;
ALTER TABLE greenfield_publisher_release_jobs
  ADD CONSTRAINT greenfield_publisher_release_jobs_cancelled_from_state_check CHECK (
    cancelled_from_state IS NULL OR cancelled_from_state IN (
      'created', 'fetching', 'validating', 'awaiting_approval',
      'signature_verified', 'ready_for_signing', 'signing',
      'signature_pending_verification', 'signing_failed', 'ready_for_review',
      'publishing', 'signature_missing', 'signature_invalid',
      'validation_failed', 'failed'
    )
  );

-- Migration 091 did not record an independently authorized approver. Preserve
-- its facts only as a new approval candidate and fail closed. A terminal
-- historical publication is retained for downgrade/reapply compatibility, but
-- can never satisfy the 092 approval helper because it has no approved actor.
UPDATE public.background_jobs AS queue
SET status = 'CANCELLED',
    lease_owner = NULL,
    lease_expires_at = NULL,
    updated_at = pg_catalog.clock_timestamp(),
    completed_at = pg_catalog.clock_timestamp(),
    error_code = 'RELEASE_APPROVAL_INVALIDATED',
    error_class = 'PUBLISHER_RELEASE_SECURITY_BOUNDARY',
    last_error = 'Legacy signing approval requires independent reapproval'
FROM public.greenfield_publisher_release_jobs AS release_job
WHERE queue.payload = pg_catalog.jsonb_build_object('releaseJobId', release_job.job_id)
  AND queue.job_type = 'publisher.release-job.sign'
  AND queue.status IN ('QUEUED', 'RETRYING', 'LEASED', 'RUNNING')
  AND release_job.state <> 'published'
  AND release_job.approved_at IS NOT NULL;

UPDATE public.greenfield_publisher_release_jobs
SET approval_candidate_facts = approved_facts,
    approval_candidate_sha256 = approval_sha256,
    approval_candidate_at = approved_at,
    approved_facts = NULL,
    approval_sha256 = NULL,
    approved_at = NULL,
    state = CASE
      WHEN state IN (
        'ready_for_signing', 'signing', 'signature_pending_verification',
        'signature_verified', 'signing_failed', 'ready_for_review', 'publishing'
      ) THEN 'awaiting_approval'
      ELSE state
    END,
    updated_at = pg_catalog.clock_timestamp(),
    revision = revision + 1,
    error = pg_catalog.jsonb_build_object(
      'code', 'RELEASE_APPROVAL_INVALIDATED',
      'message', 'Legacy signing approval requires independent reapproval'
    )
WHERE state <> 'published'
  AND approved_at IS NOT NULL;

ALTER TABLE greenfield_publisher_release_jobs
  DROP CONSTRAINT IF EXISTS greenfield_publisher_release_jobs_approval_check;
ALTER TABLE greenfield_publisher_release_jobs
  ADD CONSTRAINT greenfield_publisher_release_jobs_approval_check CHECK (
    (
      approved_at IS NULL
      AND approval_sha256 IS NULL
      AND approved_facts IS NULL
      AND approved_by_account_id IS NULL
    ) OR (
      approved_at IS NOT NULL
      AND approval_sha256 IS NOT NULL
      AND approved_facts IS NOT NULL
      AND approved_by_account_id IS NOT NULL
    ) OR (
      state = 'published'
      AND approved_at IS NOT NULL
      AND approval_sha256 IS NOT NULL
      AND approved_facts IS NOT NULL
      AND approved_by_account_id IS NULL
    )
  );

ALTER TABLE greenfield_publisher_release_jobs
  ADD CONSTRAINT greenfield_publisher_release_jobs_candidate_check CHECK (
    (
      approval_candidate_at IS NULL
      AND approval_candidate_sha256 IS NULL
      AND approval_candidate_facts IS NULL
    ) OR (
      approval_candidate_at IS NOT NULL
      AND approval_candidate_sha256 IS NOT NULL
      AND approval_candidate_facts IS NOT NULL
    )
  ),
  ADD CONSTRAINT greenfield_publisher_release_jobs_independent_approver_check CHECK (
    approved_by_account_id IS NULL OR approved_by_account_id <> created_by_account_id
  ),
  ADD CONSTRAINT greenfield_publisher_release_jobs_requester_approver_check CHECK (
    approved_by_account_id IS NULL
    OR sign_requested_by_account_id IS NULL
    OR approved_by_account_id <> sign_requested_by_account_id
  ),
  ADD CONSTRAINT greenfield_publisher_release_jobs_publication_authority_check CHECK (
    (publication_authorized_at IS NULL) = (publication_authorized_by_account_id IS NULL)
  );

ALTER TABLE greenfield_publisher_signing_audit_events
  ADD COLUMN actor_database_role NAME;

DROP INDEX IF EXISTS greenfield_publisher_release_jobs_inflight_tag_idx;
DROP INDEX IF EXISTS greenfield_publisher_release_jobs_inflight_version_idx;
CREATE UNIQUE INDEX greenfield_publisher_release_jobs_inflight_tag_idx
  ON greenfield_publisher_release_jobs (module_id, release_tag)
  WHERE state IN (
    'created', 'fetching', 'validating', 'awaiting_approval', 'ready_for_signing',
    'signing', 'signature_pending_verification', 'signature_verified',
    'ready_for_review', 'publishing'
  );
CREATE UNIQUE INDEX greenfield_publisher_release_jobs_inflight_version_idx
  ON greenfield_publisher_release_jobs (module_id, version)
  WHERE version IS NOT NULL AND state IN (
    'created', 'fetching', 'validating', 'awaiting_approval', 'ready_for_signing',
    'signing', 'signature_pending_verification', 'signature_verified',
    'ready_for_review', 'publishing'
  );

CREATE TABLE greenfield_publisher_release_signing_claims (
  transaction_id XID8 PRIMARY KEY,
  queue_job_id TEXT NOT NULL UNIQUE REFERENCES background_jobs(id) ON DELETE CASCADE,
  release_job_id TEXT NOT NULL UNIQUE REFERENCES greenfield_publisher_release_jobs(job_id) ON DELETE CASCADE,
  signing_request_id TEXT NOT NULL,
  worker_id TEXT NOT NULL CHECK (pg_catalog.length(worker_id) BETWEEN 3 AND 240),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  lease_expires_at TIMESTAMPTZ NOT NULL,
  CHECK (lease_expires_at > claimed_at)
);

REVOKE ALL ON greenfield_publisher_release_signing_claims FROM PUBLIC;

CREATE FUNCTION greenfield_publisher_authority_has(required_authority TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.greenfield_publisher_release_authority_principals AS principal
    WHERE principal.database_role = SESSION_USER::NAME
      AND principal.authority = required_authority
      AND principal.active
      AND principal.revoked_at IS NULL
  )
$$;

CREATE FUNCTION greenfield_publisher_authority_actor(required_authority TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id TEXT;
BEGIN
  SELECT principal.account_id INTO STRICT actor_id
  FROM public.greenfield_publisher_release_authority_principals AS principal
  WHERE principal.database_role = SESSION_USER::NAME
    AND principal.authority = required_authority
    AND principal.active
    AND principal.revoked_at IS NULL;
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'database authority has no bound account identity' USING ERRCODE = '42501';
  END IF;
  RETURN actor_id;
EXCEPTION WHEN NO_DATA_FOUND THEN
  RAISE EXCEPTION 'database authority is not active for %', required_authority USING ERRCODE = '42501';
END;
$$;

CREATE FUNCTION greenfield_publisher_release_approved_facts_match(candidate_job_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.greenfield_publisher_release_jobs AS release_job
    JOIN public.greenfield_module_releases AS release
      ON release.release_id = release_job.release_id
     AND release.module_id = release_job.module_id
     AND release.publisher_id = release_job.publisher_id
     AND release.version = release_job.version
     AND pg_catalog.lower(release.source_repository) = pg_catalog.lower(release_job.source_repository)
     AND release.source_commit = release_job.source_commit
     AND release.release_sha256 = release_job.artifact_sha256
    WHERE release_job.job_id = candidate_job_id
      AND release_job.approved_at IS NOT NULL
      AND release_job.approved_by_account_id IS NOT NULL
      AND release_job.approval_sha256 ~ '^[0-9a-f]{64}$'
      AND release_job.approved_facts = release_job.approval_candidate_facts
      AND release_job.approval_sha256 = release_job.approval_candidate_sha256
      AND release_job.approved_facts ->> 'schemaVersion' = '1.0.0'
      AND release_job.approved_facts ->> 'statementType' = 'modula.publisher-release.v1'
      AND release_job.approved_facts ->> 'productId' = release_job.module_id
      AND release_job.approved_facts ->> 'version' = release_job.version
      AND release_job.approved_facts ->> 'publisherId' = release_job.publisher_id
      AND pg_catalog.lower(release_job.approved_facts ->> 'sourceRepository') = pg_catalog.lower(release_job.source_repository)
      AND release_job.approved_facts ->> 'sourceSha' = release_job.source_commit
      AND release_job.approved_facts ->> 'releaseTag' = release_job.release_tag
      AND release_job.approved_facts ->> 'artifactSha256' = release_job.artifact_sha256
      AND release_job.approved_facts ->> 'manifestSha256' = release.manifest_sha256
      AND release.release_state NOT IN ('quarantined', 'revoked')
  )
$$;

CREATE FUNCTION greenfield_publisher_release_claim_must_be_consumed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.greenfield_publisher_release_signing_claims AS claim
    WHERE claim.transaction_id = NEW.transaction_id
  ) THEN
    RAISE EXCEPTION 'signing claim must be completed or failed in the transaction that created it'
      USING ERRCODE = '25000';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER greenfield_publisher_release_claim_must_be_consumed
  AFTER INSERT ON greenfield_publisher_release_signing_claims
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION greenfield_publisher_release_claim_must_be_consumed();

CREATE FUNCTION greenfield_release_approver_record(
  requested_job_id TEXT,
  expected_candidate_sha256 TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id TEXT;
  release_job RECORD;
BEGIN
  actor_id := public.greenfield_publisher_authority_actor('RELEASE_APPROVER');
  SELECT * INTO STRICT release_job
  FROM public.greenfield_publisher_release_jobs
  WHERE job_id = requested_job_id
  FOR UPDATE;

  IF release_job.state <> 'awaiting_approval'
     OR release_job.approval_candidate_sha256 IS NULL
     OR release_job.approval_candidate_facts IS NULL
     OR release_job.approval_candidate_at IS NULL
     OR release_job.approval_candidate_sha256 <> expected_candidate_sha256
     OR actor_id = release_job.created_by_account_id THEN
    RAISE EXCEPTION 'release facts are not eligible for independent approval' USING ERRCODE = '42501';
  END IF;

  UPDATE public.greenfield_publisher_release_jobs
  SET approved_facts = release_job.approval_candidate_facts,
      approval_sha256 = release_job.approval_candidate_sha256,
      approved_at = pg_catalog.clock_timestamp(),
      approved_by_account_id = actor_id,
      approval_invalidated_at = NULL,
      approval_invalidated_by_account_id = NULL,
      approval_invalidation_reason = NULL,
      state = 'ready_for_signing',
      revision = revision + 1,
      updated_at = pg_catalog.clock_timestamp()
  WHERE job_id = requested_job_id;

  IF NOT public.greenfield_publisher_release_approved_facts_match(requested_job_id) THEN
    RAISE EXCEPTION 'approved release facts do not match the immutable registry release'
      USING ERRCODE = '42501';
  END IF;

  RETURN release_job.approval_candidate_sha256;
END;
$$;

CREATE FUNCTION greenfield_release_approver_invalidate(
  requested_job_id TEXT,
  invalidation_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id TEXT;
  release_job RECORD;
BEGIN
  actor_id := public.greenfield_publisher_authority_actor('RELEASE_APPROVER');
  IF invalidation_reason IS NULL OR pg_catalog.length(pg_catalog.btrim(invalidation_reason)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'approval invalidation reason must contain 1 to 500 characters' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO STRICT release_job
  FROM public.greenfield_publisher_release_jobs
  WHERE job_id = requested_job_id
  FOR UPDATE;
  IF release_job.state IN ('published', 'cancelled') THEN
    RAISE EXCEPTION 'terminal release approval cannot be invalidated through this operation' USING ERRCODE = '42501';
  END IF;

  UPDATE public.greenfield_publisher_release_jobs
  SET approved_facts = NULL,
      approval_sha256 = NULL,
      approved_at = NULL,
      approved_by_account_id = NULL,
      approval_invalidated_at = pg_catalog.clock_timestamp(),
      approval_invalidated_by_account_id = actor_id,
      approval_invalidation_reason = pg_catalog.left(pg_catalog.btrim(invalidation_reason), 500),
      state = 'validation_failed',
      revision = revision + 1,
      updated_at = pg_catalog.clock_timestamp(),
      error = pg_catalog.jsonb_build_object('code', 'RELEASE_APPROVAL_INVALIDATED', 'message', 'Independent release approval was invalidated')
  WHERE job_id = requested_job_id;

  INSERT INTO public.greenfield_publisher_signing_audit_events (
    event_id, event_type, job_id, identity_id, publisher_id, module_id,
    actor_account_id, actor_database_role, approval_sha256, statement_sha256,
    receipt, details, created_at
  ) VALUES (
    'psae_' || pg_catalog.gen_random_uuid()::TEXT,
    'release_invalidated', release_job.job_id, release_job.signing_identity_id,
    release_job.publisher_id, release_job.module_id, actor_id, SESSION_USER::NAME,
    release_job.approval_sha256, NULL, '{}'::JSONB,
    pg_catalog.jsonb_build_object('reason', pg_catalog.left(pg_catalog.btrim(invalidation_reason), 500)),
    pg_catalog.clock_timestamp()
  );
  RETURN TRUE;
END;
$$;

CREATE FUNCTION greenfield_signing_runner_claim(
  requested_worker_id TEXT,
  requested_lease_ms INTEGER DEFAULT 600000
)
RETURNS TABLE (
  queue_job_id TEXT,
  release_job_id TEXT,
  signing_request_id TEXT,
  publisher_id TEXT,
  module_id TEXT,
  version TEXT,
  release_id TEXT,
  approval_sha256 TEXT,
  approved_facts JSONB,
  identity_id TEXT,
  signing_key_id TEXT,
  provider TEXT,
  provider_key_ref TEXT,
  identity_purpose TEXT,
  identity_first_party_authorized BOOLEAN,
  identity_valid_from TIMESTAMPTZ,
  identity_valid_until TIMESTAMPTZ,
  public_key_pem TEXT,
  public_key_fingerprint TEXT,
  attempt_count INTEGER,
  maximum_attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  current_xid XID8 := pg_catalog.pg_current_xact_id();
  observed_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  selected RECORD;
BEGIN
  IF NOT public.greenfield_publisher_authority_has('SIGNING_RUNNER') THEN
    RAISE EXCEPTION 'signing runner database authority is not active' USING ERRCODE = '42501';
  END IF;
  IF requested_worker_id IS NULL OR pg_catalog.length(requested_worker_id) NOT BETWEEN 3 AND 240 THEN
    RAISE EXCEPTION 'runner worker id must contain 3 to 240 characters' USING ERRCODE = '22023';
  END IF;
  IF requested_lease_ms NOT BETWEEN 1000 AND 900000 THEN
    RAISE EXCEPTION 'runner lease must be between 1000 and 900000 milliseconds' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.greenfield_publisher_release_signing_claims
    WHERE transaction_id = current_xid
  ) THEN
    RAISE EXCEPTION 'this transaction already owns a signing claim' USING ERRCODE = '25001';
  END IF;

  SELECT
    queue.id AS queue_job_id,
    release_job.job_id AS release_job_id,
    release_job.signing_request_id,
    release_job.publisher_id,
    release_job.module_id,
    release_job.version,
    release_job.release_id,
    release_job.approval_sha256,
    release_job.approved_facts,
    identity.identity_id,
    identity.signing_key_id,
    identity.provider,
    identity.provider_key_ref,
    identity.purpose AS identity_purpose,
    identity.first_party_authorized AS identity_first_party_authorized,
    identity.valid_from AS identity_valid_from,
    identity.valid_until AS identity_valid_until,
    signing_key.public_key_pem,
    signing_key.fingerprint AS public_key_fingerprint,
    queue.attempt_count + 1 AS attempt_count,
    queue.maximum_attempts
  INTO selected
  FROM public.background_jobs AS queue
  JOIN public.greenfield_publisher_release_jobs AS release_job
    ON release_job.job_id = queue.payload ->> 'releaseJobId'
  JOIN LATERAL (
    SELECT candidate.*
    FROM public.greenfield_publisher_online_signing_identities AS candidate
    WHERE candidate.publisher_id = release_job.publisher_id
      AND candidate.state = 'ACTIVE'
      AND candidate.valid_from <= observed_now
      AND candidate.valid_until > observed_now
      AND (
        candidate.purpose = 'PUBLISHER'
        OR (candidate.purpose = 'MODULA_FIRST_PARTY' AND candidate.first_party_authorized)
      )
    ORDER BY candidate.purpose DESC, candidate.identity_id
    LIMIT 1
  ) AS identity ON TRUE
  JOIN public.greenfield_publisher_signing_keys AS signing_key
    ON signing_key.key_id = identity.signing_key_id
   AND signing_key.publisher_id = release_job.publisher_id
   AND signing_key.state = 'ACTIVE'
   AND signing_key.revoked_at IS NULL
   AND signing_key.valid_from <= observed_now
   AND (signing_key.valid_until IS NULL OR signing_key.valid_until > observed_now)
  JOIN public.greenfield_publisher_signing_authorizations AS signing_authorization
    ON signing_authorization.publisher_id = release_job.publisher_id
   AND signing_authorization.product_id = release_job.module_id
   AND signing_authorization.account_id = release_job.sign_requested_by_account_id
   AND signing_authorization.state = 'ACTIVE'
   AND signing_authorization.valid_from <= observed_now
   AND (signing_authorization.valid_until IS NULL OR signing_authorization.valid_until > observed_now)
  JOIN public.greenfield_publishers AS publisher
    ON publisher.publisher_id = release_job.publisher_id
   AND publisher.status = 'verified'
   AND publisher.revoked_at IS NULL
  WHERE queue.dispatch_mode = 'PUBLISHER_RELEASE_RUNNER'
    AND queue.service_id = 'service.publisher-release-runner'
    AND queue.job_type = 'publisher.release-job.sign'
    AND queue.payload = pg_catalog.jsonb_build_object('releaseJobId', release_job.job_id)
    AND queue.status IN ('QUEUED', 'RETRYING')
    AND queue.available_at <= observed_now
    AND release_job.state = 'signing'
    AND release_job.signing_request_id IS NOT NULL
    AND release_job.sign_requested_by_account_id IS NOT NULL
    AND release_job.approved_by_account_id IS NOT NULL
    AND release_job.approved_by_account_id <> release_job.sign_requested_by_account_id
    AND (
      (publisher.trust_level = 'firstParty'
        AND identity.purpose = 'MODULA_FIRST_PARTY'
        AND identity.first_party_authorized
        AND signing_authorization.first_party_authorized)
      OR
      (publisher.trust_level IS DISTINCT FROM 'firstParty'
        AND identity.purpose = 'PUBLISHER')
    )
    AND public.greenfield_publisher_release_approved_facts_match(release_job.job_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.greenfield_module_quarantines AS quarantine
      WHERE quarantine.release_id = release_job.release_id AND quarantine.lifted_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.greenfield_module_revocations AS revocation
      WHERE (revocation.scope = 'release' AND revocation.target_id = release_job.release_id)
         OR (revocation.scope = 'module' AND revocation.target_id = release_job.module_id)
         OR (revocation.scope = 'publisher' AND revocation.target_id = release_job.publisher_id)
         OR (revocation.scope = 'signingKey' AND revocation.target_id = identity.signing_key_id)
    )
  ORDER BY queue.priority, queue.created_at
  FOR UPDATE OF queue, release_job SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.background_jobs AS queue
  SET status = 'RUNNING',
      lease_owner = requested_worker_id,
      lease_expires_at = observed_now + (requested_lease_ms * INTERVAL '1 millisecond'),
      attempt_count = selected.attempt_count,
      started_at = observed_now,
      updated_at = observed_now
  WHERE queue.id = selected.queue_job_id;

  UPDATE public.greenfield_publisher_release_jobs AS release_job
  SET signing_started_at = observed_now,
      signing_identity_id = selected.identity_id,
      updated_at = observed_now,
      revision = revision + 1
  WHERE release_job.job_id = selected.release_job_id;

  INSERT INTO public.greenfield_publisher_release_signing_claims (
    transaction_id, queue_job_id, release_job_id, signing_request_id,
    worker_id, claimed_at, lease_expires_at
  ) VALUES (
    current_xid, selected.queue_job_id, selected.release_job_id,
    selected.signing_request_id, requested_worker_id, observed_now,
    observed_now + (requested_lease_ms * INTERVAL '1 millisecond')
  );

  INSERT INTO public.greenfield_publisher_signing_audit_events (
    event_id, event_type, job_id, identity_id, publisher_id, module_id,
    actor_account_id, actor_database_role, approval_sha256, statement_sha256,
    receipt, details, created_at
  ) VALUES (
    'psae_' || pg_catalog.gen_random_uuid()::TEXT,
    'signing_started', selected.release_job_id, selected.identity_id,
    selected.publisher_id, selected.module_id, NULL, SESSION_USER::NAME,
    selected.approval_sha256, NULL, '{}'::JSONB,
    pg_catalog.jsonb_build_object('signingRequestId', selected.signing_request_id),
    observed_now
  );

  RETURN QUERY SELECT
    selected.queue_job_id::TEXT,
    selected.release_job_id::TEXT,
    selected.signing_request_id::TEXT,
    selected.publisher_id::TEXT,
    selected.module_id::TEXT,
    selected.version::TEXT,
    selected.release_id::TEXT,
    selected.approval_sha256::TEXT,
    selected.approved_facts::JSONB,
    selected.identity_id::TEXT,
    selected.signing_key_id::TEXT,
    selected.provider::TEXT,
    selected.provider_key_ref::TEXT,
    selected.identity_purpose::TEXT,
    selected.identity_first_party_authorized::BOOLEAN,
    selected.identity_valid_from::TIMESTAMPTZ,
    selected.identity_valid_until::TIMESTAMPTZ,
    selected.public_key_pem::TEXT,
    selected.public_key_fingerprint::TEXT,
    selected.attempt_count::INTEGER,
    selected.maximum_attempts::INTEGER;
END;
$$;

CREATE FUNCTION greenfield_signing_runner_submit_signature(
  requested_queue_job_id TEXT,
  requested_signature TEXT,
  requested_statement_sha256 TEXT,
  requested_provider_key_version TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  current_xid XID8 := pg_catalog.pg_current_xact_id();
  observed_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  claim_row RECORD;
  release_job RECORD;
  identity_row RECORD;
  statement JSONB;
  signature_identifier TEXT;
BEGIN
  IF NOT public.greenfield_publisher_authority_has('SIGNING_RUNNER') THEN
    RAISE EXCEPTION 'signing runner database authority is not active' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO STRICT claim_row
  FROM public.greenfield_publisher_release_signing_claims
  WHERE transaction_id = current_xid
    AND queue_job_id = requested_queue_job_id
  FOR UPDATE;
  IF claim_row.lease_expires_at <= observed_now THEN
    RAISE EXCEPTION 'signing claim expired before signature submission' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO STRICT release_job
  FROM public.greenfield_publisher_release_jobs
  WHERE job_id = claim_row.release_job_id
    AND state = 'signing'
    AND signing_request_id = claim_row.signing_request_id
  FOR UPDATE;
  SELECT identity.*, signing_key.fingerprint
  INTO STRICT identity_row
  FROM public.greenfield_publisher_online_signing_identities AS identity
  JOIN public.greenfield_publisher_signing_keys AS signing_key
    ON signing_key.key_id = identity.signing_key_id
   AND signing_key.publisher_id = identity.publisher_id
  WHERE identity.identity_id = release_job.signing_identity_id
    AND identity.publisher_id = release_job.publisher_id
    AND identity.state = 'ACTIVE'
    AND identity.valid_from <= observed_now
    AND identity.valid_until > observed_now
    AND signing_key.state = 'ACTIVE'
    AND signing_key.revoked_at IS NULL
    AND signing_key.valid_from <= observed_now
    AND (signing_key.valid_until IS NULL OR signing_key.valid_until > observed_now)
  FOR SHARE OF identity, signing_key;

  IF requested_signature !~ '^[A-Za-z0-9_-]{86}$'
     OR requested_statement_sha256 !~ '^[0-9a-f]{64}$'
     OR (requested_provider_key_version IS NOT NULL AND requested_provider_key_version !~ '^[1-9][0-9]{0,8}$')
     OR NOT public.greenfield_publisher_release_approved_facts_match(release_job.job_id)
     OR EXISTS (
       SELECT 1 FROM public.greenfield_module_quarantines AS quarantine
       WHERE quarantine.release_id = release_job.release_id AND quarantine.lifted_at IS NULL
     )
     OR EXISTS (
       SELECT 1 FROM public.greenfield_module_revocations AS revocation
       WHERE (revocation.scope = 'release' AND revocation.target_id = release_job.release_id)
          OR (revocation.scope = 'module' AND revocation.target_id = release_job.module_id)
          OR (revocation.scope = 'publisher' AND revocation.target_id = release_job.publisher_id)
          OR (revocation.scope = 'signingKey' AND revocation.target_id = identity_row.signing_key_id)
     ) THEN
    RAISE EXCEPTION 'pending signature does not satisfy the approved release boundary' USING ERRCODE = '42501';
  END IF;

  statement := release_job.approved_facts || pg_catalog.jsonb_build_object('signingKeyId', identity_row.signing_key_id);
  signature_identifier := 'module-signature:' || release_job.release_id || ':' || identity_row.signing_key_id;

  INSERT INTO public.greenfield_module_release_signatures (
    signature_id, release_id, signature_key_id, signature, algorithm,
    verified_at, revoked_at, statement, statement_sha256,
    verification_state, verification_detail, public_key_fingerprint, observed_at
  ) VALUES (
    signature_identifier, release_job.release_id, identity_row.signing_key_id,
    requested_signature, 'Ed25519', NULL, NULL, statement,
    requested_statement_sha256, 'pending', 'Awaiting independent trust verifier',
    NULL, observed_now
  );

  UPDATE public.greenfield_publisher_release_jobs
  SET state = 'signature_pending_verification',
      signed_at = observed_now,
      signing_receipt = NULL,
      signature = pg_catalog.jsonb_build_object(
        'state', 'pending',
        'identityId', identity_row.identity_id,
        'keyId', identity_row.signing_key_id,
        'provider', identity_row.provider,
        'providerKeyVersion', CASE WHEN requested_provider_key_version IS NULL THEN NULL ELSE requested_provider_key_version::INTEGER END,
        'algorithm', 'Ed25519',
        'approvalSha256', release_job.approval_sha256,
        'statementSha256', requested_statement_sha256
      ),
      revision = revision + 1,
      updated_at = observed_now
  WHERE job_id = release_job.job_id;

  UPDATE public.background_jobs
  SET status = 'SUCCEEDED', lease_owner = NULL, lease_expires_at = NULL,
      finished_at = observed_now, completed_at = observed_now, updated_at = observed_now,
      last_error = NULL, error_code = NULL, error_class = NULL
  WHERE id = claim_row.queue_job_id
    AND status = 'RUNNING'
    AND lease_owner = claim_row.worker_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'signing queue claim is no longer current' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.greenfield_publisher_signing_audit_events (
    event_id, event_type, job_id, identity_id, publisher_id, module_id,
    actor_account_id, actor_database_role, approval_sha256, statement_sha256,
    receipt, details, created_at
  ) VALUES (
    'psae_' || pg_catalog.gen_random_uuid()::TEXT,
    'signature_created', release_job.job_id, identity_row.identity_id,
    release_job.publisher_id, release_job.module_id, NULL, SESSION_USER::NAME,
    release_job.approval_sha256, requested_statement_sha256, '{}'::JSONB,
    pg_catalog.jsonb_build_object('provider', identity_row.provider, 'status', 'pendingVerification'),
    observed_now
  );

  DELETE FROM public.greenfield_publisher_release_signing_claims
  WHERE transaction_id = current_xid;
  RETURN signature_identifier;
END;
$$;

CREATE FUNCTION greenfield_signing_runner_fail(
  requested_queue_job_id TEXT,
  requested_failure_code TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  current_xid XID8 := pg_catalog.pg_current_xact_id();
  observed_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  claim_row RECORD;
  queue_row RECORD;
  release_job RECORD;
  exhausted BOOLEAN;
  result_status TEXT;
BEGIN
  IF NOT public.greenfield_publisher_authority_has('SIGNING_RUNNER') THEN
    RAISE EXCEPTION 'signing runner database authority is not active' USING ERRCODE = '42501';
  END IF;
  IF requested_failure_code NOT IN ('PROVIDER_UNAVAILABLE', 'SIGNATURE_INVALID', 'IDENTITY_UNAVAILABLE') THEN
    RAISE EXCEPTION 'signing failure code is not permitted' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO STRICT claim_row
  FROM public.greenfield_publisher_release_signing_claims
  WHERE transaction_id = current_xid AND queue_job_id = requested_queue_job_id
  FOR UPDATE;
  SELECT * INTO STRICT queue_row FROM public.background_jobs
  WHERE id = claim_row.queue_job_id AND status = 'RUNNING' AND lease_owner = claim_row.worker_id
  FOR UPDATE;
  SELECT * INTO STRICT release_job FROM public.greenfield_publisher_release_jobs
  WHERE job_id = claim_row.release_job_id AND state = 'signing'
  FOR UPDATE;
  exhausted := queue_row.attempt_count >= queue_row.maximum_attempts
    OR requested_failure_code IN ('SIGNATURE_INVALID', 'IDENTITY_UNAVAILABLE');
  result_status := CASE WHEN exhausted THEN 'DEAD_LETTER' ELSE 'RETRYING' END;

  UPDATE public.background_jobs
  SET status = result_status,
      lease_owner = NULL,
      lease_expires_at = NULL,
      available_at = CASE WHEN exhausted THEN available_at ELSE observed_now + INTERVAL '15 seconds' END,
      finished_at = CASE WHEN exhausted THEN observed_now ELSE finished_at END,
      completed_at = CASE WHEN exhausted THEN observed_now ELSE NULL END,
      updated_at = observed_now,
      last_error = requested_failure_code,
      error_code = requested_failure_code,
      error_class = 'PUBLISHER_RELEASE_SIGNING'
  WHERE id = claim_row.queue_job_id;

  UPDATE public.greenfield_publisher_release_jobs
  SET state = CASE WHEN exhausted THEN 'signing_failed' ELSE state END,
      signing_started_at = NULL,
      error = CASE WHEN exhausted
        THEN pg_catalog.jsonb_build_object('code', requested_failure_code, 'message', 'Signing failed closed')
        ELSE error END,
      revision = revision + 1,
      updated_at = observed_now
  WHERE job_id = claim_row.release_job_id;

  INSERT INTO public.greenfield_publisher_signing_audit_events (
    event_id, event_type, job_id, identity_id, publisher_id, module_id,
    actor_account_id, actor_database_role, approval_sha256, statement_sha256,
    receipt, details, created_at
  ) VALUES (
    'psae_' || pg_catalog.gen_random_uuid()::TEXT,
    'signing_failed', release_job.job_id, release_job.signing_identity_id,
    release_job.publisher_id, release_job.module_id, NULL, SESSION_USER::NAME,
    release_job.approval_sha256, NULL, '{}'::JSONB,
    pg_catalog.jsonb_build_object('code', requested_failure_code, 'retryable', NOT exhausted),
    observed_now
  );
  DELETE FROM public.greenfield_publisher_release_signing_claims
  WHERE transaction_id = current_xid;
  RETURN result_status;
END;
$$;

CREATE FUNCTION greenfield_trust_verifier_claim(requested_job_id TEXT DEFAULT NULL)
RETURNS TABLE (
  job_id TEXT,
  signature_id TEXT,
  publisher_id TEXT,
  module_id TEXT,
  release_id TEXT,
  approval_sha256 TEXT,
  statement JSONB,
  statement_sha256 TEXT,
  signature_key_id TEXT,
  signature TEXT,
  algorithm TEXT,
  public_key_pem TEXT,
  public_key_fingerprint TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF NOT public.greenfield_publisher_authority_has('TRUST_VERIFIER') THEN
    RAISE EXCEPTION 'trust verifier database authority is not active' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    release_job.job_id,
    signature_row.signature_id,
    release_job.publisher_id,
    release_job.module_id,
    release_job.release_id,
    release_job.approval_sha256,
    signature_row.statement,
    signature_row.statement_sha256,
    signature_row.signature_key_id,
    signature_row.signature,
    signature_row.algorithm,
    signing_key.public_key_pem,
    signing_key.fingerprint
  FROM public.greenfield_publisher_release_jobs AS release_job
  JOIN public.greenfield_module_release_signatures AS signature_row
    ON signature_row.release_id = release_job.release_id
   AND signature_row.verification_state = 'pending'
   AND signature_row.verified_at IS NULL
   AND signature_row.revoked_at IS NULL
  JOIN public.greenfield_publisher_signing_keys AS signing_key
    ON signing_key.key_id = signature_row.signature_key_id
   AND signing_key.publisher_id = release_job.publisher_id
   AND signing_key.state = 'ACTIVE'
   AND signing_key.revoked_at IS NULL
  WHERE release_job.state = 'signature_pending_verification'
    AND (requested_job_id IS NULL OR release_job.job_id = requested_job_id)
    AND public.greenfield_publisher_release_approved_facts_match(release_job.job_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.greenfield_module_quarantines AS quarantine
      WHERE quarantine.release_id = release_job.release_id AND quarantine.lifted_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.greenfield_module_revocations AS revocation
      WHERE (revocation.scope = 'release' AND revocation.target_id = release_job.release_id)
         OR (revocation.scope = 'module' AND revocation.target_id = release_job.module_id)
         OR (revocation.scope = 'publisher' AND revocation.target_id = release_job.publisher_id)
         OR (revocation.scope = 'signingKey' AND revocation.target_id = signature_row.signature_key_id)
    )
  ORDER BY release_job.updated_at, release_job.job_id
  LIMIT 1
  FOR UPDATE OF release_job, signature_row SKIP LOCKED;
END;
$$;

CREATE FUNCTION greenfield_trust_verifier_record(
  requested_job_id TEXT,
  requested_signature_id TEXT,
  verification_succeeded BOOLEAN,
  verification_detail TEXT,
  verified_public_key_fingerprint TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  observed_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  release_job RECORD;
  signature_row RECORD;
  target_state TEXT;
  verified_detail TEXT := verification_detail;
BEGIN
  IF NOT public.greenfield_publisher_authority_has('TRUST_VERIFIER') THEN
    RAISE EXCEPTION 'trust verifier database authority is not active' USING ERRCODE = '42501';
  END IF;
  IF verified_detail IS NULL OR pg_catalog.length(pg_catalog.btrim(verified_detail)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'verification detail must contain 1 to 1000 characters' USING ERRCODE = '22023';
  END IF;
  IF verification_succeeded AND verified_public_key_fingerprint !~ '^sha256:[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'verified public key fingerprint is malformed' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO STRICT release_job
  FROM public.greenfield_publisher_release_jobs
  WHERE job_id = requested_job_id
    AND state = 'signature_pending_verification'
  FOR UPDATE;
  SELECT pending_signature.*, signing_key.fingerprint AS expected_public_key_fingerprint
  INTO STRICT signature_row
  FROM public.greenfield_module_release_signatures AS pending_signature
  JOIN public.greenfield_publisher_signing_keys AS signing_key
    ON signing_key.key_id = pending_signature.signature_key_id
   AND signing_key.publisher_id = release_job.publisher_id
   AND signing_key.state = 'ACTIVE'
   AND signing_key.revoked_at IS NULL
  WHERE pending_signature.signature_id = requested_signature_id
    AND pending_signature.release_id = release_job.release_id
    AND pending_signature.verification_state = 'pending'
    AND pending_signature.verified_at IS NULL
    AND pending_signature.revoked_at IS NULL
  FOR UPDATE OF pending_signature;

  IF NOT public.greenfield_publisher_release_approved_facts_match(release_job.job_id)
     OR signature_row.statement <> (
       release_job.approved_facts || pg_catalog.jsonb_build_object('signingKeyId', signature_row.signature_key_id)
     )
     OR signature_row.statement_sha256 IS DISTINCT FROM release_job.signature ->> 'statementSha256'
     OR (verification_succeeded AND verified_public_key_fingerprint IS DISTINCT FROM signature_row.expected_public_key_fingerprint)
     OR EXISTS (
       SELECT 1 FROM public.greenfield_module_quarantines AS quarantine
       WHERE quarantine.release_id = release_job.release_id AND quarantine.lifted_at IS NULL
     )
     OR EXISTS (
       SELECT 1 FROM public.greenfield_module_revocations AS revocation
       WHERE (revocation.scope = 'release' AND revocation.target_id = release_job.release_id)
          OR (revocation.scope = 'module' AND revocation.target_id = release_job.module_id)
          OR (revocation.scope = 'publisher' AND revocation.target_id = release_job.publisher_id)
          OR (revocation.scope = 'signingKey' AND revocation.target_id = signature_row.signature_key_id)
     ) THEN
    verification_succeeded := FALSE;
    verified_detail := 'Database revalidation refused the pending signature evidence';
  END IF;

  target_state := CASE WHEN verification_succeeded THEN 'verified' ELSE 'invalid' END;
  UPDATE public.greenfield_module_release_signatures
  SET verification_state = target_state,
      verified_at = CASE WHEN verification_succeeded THEN observed_now ELSE NULL END,
      verification_detail = pg_catalog.left(pg_catalog.btrim(verified_detail), 1000),
      public_key_fingerprint = CASE WHEN verification_succeeded THEN verified_public_key_fingerprint ELSE NULL END
  WHERE signature_id = requested_signature_id;

  IF verification_succeeded THEN
    UPDATE public.greenfield_module_releases
    SET release_state = 'verified', updated_at = observed_now
    WHERE release_id = release_job.release_id AND release_state = 'pendingReview';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'release is not eligible for trust verification' USING ERRCODE = '42501';
    END IF;
  ELSE
    UPDATE public.greenfield_module_releases
    SET release_state = 'quarantined', quarantined_at = COALESCE(quarantined_at, observed_now), updated_at = observed_now
    WHERE release_id = release_job.release_id AND release_state NOT IN ('published', 'revoked');
  END IF;

  UPDATE public.greenfield_publisher_release_jobs
  SET state = CASE WHEN verification_succeeded THEN 'ready_for_review' ELSE 'signature_invalid' END,
      signature = signature || pg_catalog.jsonb_build_object(
        'state', CASE WHEN verification_succeeded THEN 'verified' ELSE 'invalid' END,
        'publicKeyFingerprint', CASE WHEN verification_succeeded THEN verified_public_key_fingerprint ELSE NULL END,
        'verifiedAt', CASE WHEN verification_succeeded THEN observed_now ELSE NULL END,
        'detail', pg_catalog.left(pg_catalog.btrim(verified_detail), 1000)
      ),
      signing_receipt = CASE WHEN verification_succeeded THEN pg_catalog.jsonb_build_object(
        'receiptId', 'psrc_' || pg_catalog.gen_random_uuid()::TEXT,
        'provider', release_job.signature ->> 'provider',
        'identityId', release_job.signing_identity_id,
        'keyId', signature_row.signature_key_id,
        'publicKeyFingerprint', verified_public_key_fingerprint,
        'providerKeyVersion', release_job.signature ->> 'providerKeyVersion',
        'approvalSha256', release_job.approval_sha256,
        'statementSha256', signature_row.statement_sha256,
        'verifiedAt', observed_now
      ) ELSE NULL END,
      revision = revision + 1,
      updated_at = observed_now,
      error = CASE WHEN verification_succeeded THEN NULL
        ELSE pg_catalog.jsonb_build_object('code', 'SIGNATURE_INVALID', 'message', 'Independent signature verification failed') END
  WHERE job_id = release_job.job_id;

  IF verification_succeeded THEN
    INSERT INTO public.greenfield_publisher_signing_audit_events (
      event_id, event_type, job_id, identity_id, publisher_id, module_id,
      actor_account_id, actor_database_role, approval_sha256, statement_sha256,
      receipt, details, created_at
    ) VALUES (
      'psae_' || pg_catalog.gen_random_uuid()::TEXT,
      'signature_verified', release_job.job_id, release_job.signing_identity_id,
      release_job.publisher_id, release_job.module_id, NULL, SESSION_USER::NAME,
      release_job.approval_sha256, signature_row.statement_sha256,
      pg_catalog.jsonb_build_object('publicKeyFingerprint', verified_public_key_fingerprint),
      pg_catalog.jsonb_build_object('detail', pg_catalog.left(pg_catalog.btrim(verified_detail), 1000)),
      observed_now
    );
  END IF;
  RETURN target_state;
END;
$$;

CREATE FUNCTION greenfield_publication_authority_publish(requested_job_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id TEXT;
  observed_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  release_job RECORD;
  release_row RECORD;
  signature_row RECORD;
BEGIN
  actor_id := public.greenfield_publisher_authority_actor('PUBLICATION_AUTHORITY');
  SELECT * INTO STRICT release_job
  FROM public.greenfield_publisher_release_jobs
  WHERE job_id = requested_job_id AND state = 'publishing'
  FOR UPDATE;
  SELECT * INTO STRICT release_row
  FROM public.greenfield_module_releases
  WHERE release_id = release_job.release_id
  FOR UPDATE;
  SELECT * INTO STRICT signature_row
  FROM public.greenfield_module_release_signatures
  WHERE release_id = release_job.release_id
    AND verification_state = 'verified'
    AND verified_at IS NOT NULL
    AND revoked_at IS NULL
  FOR SHARE;

  IF release_job.publish_requested_by_account_id IS NULL
     OR release_job.approved_by_account_id IS NULL
     OR release_job.approved_by_account_id = release_job.publish_requested_by_account_id
     OR NOT public.greenfield_publisher_release_approved_facts_match(release_job.job_id)
     OR release_job.signature ->> 'state' <> 'verified'
     OR release_job.validation ->> 'passed' <> 'true'
     OR release_row.release_state <> 'verified'
     OR EXISTS (
       SELECT 1 FROM public.greenfield_module_quarantines AS quarantine
       WHERE quarantine.release_id = release_job.release_id AND quarantine.lifted_at IS NULL
     )
     OR EXISTS (
       SELECT 1 FROM public.greenfield_module_revocations AS revocation
       WHERE (revocation.scope = 'release' AND revocation.target_id = release_job.release_id)
          OR (revocation.scope = 'module' AND revocation.target_id = release_job.module_id)
          OR (revocation.scope = 'publisher' AND revocation.target_id = release_job.publisher_id)
          OR (revocation.scope = 'signingKey' AND revocation.target_id = signature_row.signature_key_id)
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.greenfield_publishers AS publisher
       WHERE publisher.publisher_id = release_job.publisher_id
         AND publisher.status = 'verified'
         AND publisher.revoked_at IS NULL
     ) THEN
    RAISE EXCEPTION 'publication revalidation refused the release transition' USING ERRCODE = '42501';
  END IF;

  UPDATE public.greenfield_module_releases
  SET release_state = 'published', published_at = observed_now, updated_at = observed_now
  WHERE release_id = release_job.release_id AND release_state = 'verified';
  UPDATE public.greenfield_publisher_release_jobs
  SET state = 'published', published_at = observed_now,
      publication_authorized_by_account_id = actor_id,
      publication_authorized_at = observed_now,
      revision = revision + 1, updated_at = observed_now
  WHERE job_id = release_job.job_id;

  INSERT INTO public.greenfield_publisher_signing_audit_events (
    event_id, event_type, job_id, identity_id, publisher_id, module_id,
    actor_account_id, actor_database_role, approval_sha256, statement_sha256,
    receipt, details, created_at
  ) VALUES (
    'psae_' || pg_catalog.gen_random_uuid()::TEXT,
    'publication_authorized', release_job.job_id, release_job.signing_identity_id,
    release_job.publisher_id, release_job.module_id, actor_id, SESSION_USER::NAME,
    release_job.approval_sha256, signature_row.statement_sha256,
    pg_catalog.jsonb_build_object('releaseId', release_job.release_id),
    pg_catalog.jsonb_build_object('publicationRequester', release_job.publish_requested_by_account_id),
    observed_now
  );
  RETURN release_job.release_id;
END;
$$;

CREATE FUNCTION greenfield_publication_authority_publish_next()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  observed_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  selected RECORD;
  release_identifier TEXT;
BEGIN
  IF NOT public.greenfield_publisher_authority_has('PUBLICATION_AUTHORITY') THEN
    RAISE EXCEPTION 'publication database authority is not active' USING ERRCODE = '42501';
  END IF;
  SELECT queue.id AS queue_job_id, release_job.job_id
  INTO selected
  FROM public.background_jobs AS queue
  JOIN public.greenfield_publisher_release_jobs AS release_job
    ON release_job.job_id = queue.payload ->> 'releaseJobId'
  WHERE queue.dispatch_mode = 'PUBLISHER_RELEASE_RUNNER'
    AND queue.service_id = 'service.publisher-release-runner'
    AND queue.job_type = 'publisher.release-job.publish'
    AND queue.payload = pg_catalog.jsonb_build_object('releaseJobId', release_job.job_id)
    AND queue.status IN ('QUEUED', 'RETRYING')
    AND queue.available_at <= observed_now
    AND release_job.state = 'publishing'
  ORDER BY queue.priority, queue.created_at
  FOR UPDATE OF queue, release_job SKIP LOCKED
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  release_identifier := public.greenfield_publication_authority_publish(selected.job_id);
  UPDATE public.background_jobs
  SET status = 'SUCCEEDED',
      lease_owner = NULL,
      lease_expires_at = NULL,
      attempt_count = attempt_count + 1,
      started_at = COALESCE(started_at, observed_now),
      finished_at = observed_now,
      completed_at = observed_now,
      updated_at = observed_now,
      last_error = NULL,
      error_code = NULL,
      error_class = NULL
  WHERE id = selected.queue_job_id;
  RETURN release_identifier;
END;
$$;

CREATE FUNCTION greenfield_publisher_release_authority_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.approved_facts IS DISTINCT FROM OLD.approved_facts
     OR NEW.approval_sha256 IS DISTINCT FROM OLD.approval_sha256
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by_account_id IS DISTINCT FROM OLD.approved_by_account_id
     OR NEW.approval_invalidated_at IS DISTINCT FROM OLD.approval_invalidated_at
     OR NEW.approval_invalidated_by_account_id IS DISTINCT FROM OLD.approval_invalidated_by_account_id
     OR NEW.approval_invalidation_reason IS DISTINCT FROM OLD.approval_invalidation_reason
     OR (OLD.approved_at IS NOT NULL AND (
       NEW.approval_candidate_facts IS DISTINCT FROM OLD.approval_candidate_facts
       OR NEW.approval_candidate_sha256 IS DISTINCT FROM OLD.approval_candidate_sha256
       OR NEW.approval_candidate_at IS DISTINCT FROM OLD.approval_candidate_at
     )) THEN
    IF NOT public.greenfield_publisher_authority_has('RELEASE_APPROVER') THEN
      RAISE EXCEPTION 'release approval facts require the independent approver authority' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.publication_authorized_by_account_id IS DISTINCT FROM OLD.publication_authorized_by_account_id
     OR NEW.publication_authorized_at IS DISTINCT FROM OLD.publication_authorized_at
     OR (NEW.state = 'published' AND OLD.state <> 'published') THEN
    IF NOT public.greenfield_publisher_authority_has('PUBLICATION_AUTHORITY') THEN
      RAISE EXCEPTION 'publication transition requires publication authority' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER greenfield_publisher_release_authority_guard
  BEFORE UPDATE ON greenfield_publisher_release_jobs
  FOR EACH ROW EXECUTE FUNCTION greenfield_publisher_release_authority_guard();

CREATE FUNCTION greenfield_publisher_signature_evidence_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  online_release BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.release_id IS DISTINCT FROM OLD.release_id
    OR NEW.signature_key_id IS DISTINCT FROM OLD.signature_key_id
    OR NEW.signature IS DISTINCT FROM OLD.signature
    OR NEW.algorithm IS DISTINCT FROM OLD.algorithm
    OR NEW.statement IS DISTINCT FROM OLD.statement
    OR NEW.statement_sha256 IS DISTINCT FROM OLD.statement_sha256
    OR NEW.observed_at IS DISTINCT FROM OLD.observed_at
  ) THEN
    RAISE EXCEPTION 'signed release statement and artifact identity are immutable' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.greenfield_publisher_release_jobs AS release_job
    WHERE release_job.release_id = COALESCE(NEW.release_id, OLD.release_id)
      AND release_job.signing_request_id IS NOT NULL
  ) INTO online_release;
  IF online_release AND TG_OP = 'INSERT' AND NEW.verification_state IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'online signing evidence must begin pending independent verification' USING ERRCODE = '42501';
  END IF;
  IF online_release AND TG_OP = 'UPDATE' AND (
    NEW.verification_state IS DISTINCT FROM OLD.verification_state
    OR NEW.verification_detail IS DISTINCT FROM OLD.verification_detail
    OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
    OR NEW.public_key_fingerprint IS DISTINCT FROM OLD.public_key_fingerprint
  ) AND NOT public.greenfield_publisher_authority_has('TRUST_VERIFIER') THEN
    RAISE EXCEPTION 'online signature verification state requires trust verifier authority' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER greenfield_publisher_signature_evidence_guard
  BEFORE INSERT OR UPDATE ON greenfield_module_release_signatures
  FOR EACH ROW EXECUTE FUNCTION greenfield_publisher_signature_evidence_guard();

CREATE FUNCTION greenfield_publisher_release_immutable_facts_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.release_id IS DISTINCT FROM OLD.release_id
     OR NEW.module_version_id IS DISTINCT FROM OLD.module_version_id
     OR NEW.extension_id IS DISTINCT FROM OLD.extension_id
     OR NEW.extension_version_id IS DISTINCT FROM OLD.extension_version_id
     OR NEW.module_id IS DISTINCT FROM OLD.module_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.publisher_id IS DISTINCT FROM OLD.publisher_id
     OR NEW.source_repository IS DISTINCT FROM OLD.source_repository
     OR NEW.source_commit IS DISTINCT FROM OLD.source_commit
     OR NEW.manifest_path IS DISTINCT FROM OLD.manifest_path
     OR NEW.manifest_sha256 IS DISTINCT FROM OLD.manifest_sha256
     OR NEW.release_sha256 IS DISTINCT FROM OLD.release_sha256
     OR NEW.signature_key_id IS DISTINCT FROM OLD.signature_key_id
     OR NEW.signature IS DISTINCT FROM OLD.signature
     OR NEW.compatibility IS DISTINCT FROM OLD.compatibility
     OR NEW.license_status IS DISTINCT FROM OLD.license_status
     OR NEW.trust_level IS DISTINCT FROM OLD.trust_level
     OR NEW.product_kind IS DISTINCT FROM OLD.product_kind
     OR NEW.extension_product IS DISTINCT FROM OLD.extension_product
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'registry release identity, source, artifact and trust facts are immutable'
      USING ERRCODE = '42501';
  END IF;
  IF OLD.release_state IN ('quarantined', 'revoked')
     AND NEW.release_state IS DISTINCT FROM OLD.release_state THEN
    RAISE EXCEPTION 'quarantined or revoked releases cannot be promoted'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER greenfield_publisher_release_immutable_facts_guard
  BEFORE UPDATE ON greenfield_module_releases
  FOR EACH ROW EXECUTE FUNCTION greenfield_publisher_release_immutable_facts_guard();

REVOKE ALL ON FUNCTION greenfield_publisher_authority_has(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_publisher_authority_actor(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_publisher_release_approved_facts_match(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_publisher_release_claim_must_be_consumed() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_release_approver_record(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_release_approver_invalidate(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_signing_runner_claim(TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_signing_runner_submit_signature(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_signing_runner_fail(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_trust_verifier_claim(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_trust_verifier_record(TEXT, TEXT, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_publication_authority_publish(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_publication_authority_publish_next() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_publisher_release_authority_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_publisher_signature_evidence_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_publisher_release_immutable_facts_guard() FROM PUBLIC;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '092')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = pg_catalog.clock_timestamp();
