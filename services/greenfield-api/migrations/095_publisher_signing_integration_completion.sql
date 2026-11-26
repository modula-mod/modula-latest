-- GREENFIELD-SIGNER-FINISH: close the remaining integration race without
-- changing the independently certified 092-094 authorization architecture.
--
-- Concurrent identical first revocations previously raced between the lookup
-- and INSERT in migration 094.  Serialize only the immutable (scope,target)
-- key inside the transaction; callers with identical facts then replay the
-- same revocation ID, while conflicting facts still fail closed.
--
-- Vault Transit rotates a key version under the same provider key reference.
-- Migration 091 made that reference globally unique, which prevented the
-- migration 094 rotation authority from retaining the revoked predecessor and
-- creating its active successor.  Preserve immutable history and require the
-- reference to be unique across every identity that is not revoked.

ALTER TABLE greenfield_publisher_online_signing_identities
  DROP CONSTRAINT greenfield_publisher_online_signi_provider_provider_key_ref_key;

CREATE UNIQUE INDEX greenfield_online_signing_identity_live_provider_ref_idx
  ON greenfield_publisher_online_signing_identities (provider, provider_key_ref)
  WHERE state <> 'REVOKED';

-- Approval policy evidence is part of the authoritative transition, rather
-- than an application log that can drift from the database decision.
CREATE TABLE greenfield_release_approval_decisions (
  decision_id TEXT PRIMARY KEY CHECK (decision_id ~ '^prad_[0-9a-f-]{36}$'),
  job_id TEXT NOT NULL UNIQUE REFERENCES greenfield_publisher_release_jobs(job_id),
  candidate_sha256 TEXT NOT NULL CHECK (candidate_sha256 ~ '^[0-9a-f]{64}$'),
  policy_id TEXT NOT NULL CHECK (policy_id ~ '^[A-Za-z0-9][A-Za-z0-9._:/@+-]{2,239}$'),
  evidence_reference TEXT NOT NULL CHECK (evidence_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/@+-]{2,239}$'),
  decision_source TEXT NOT NULL CHECK (decision_source IN ('GOVERNANCE_DECISION', 'AUTOMATED_TEST_POLICY')),
  actor_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  actor_database_role NAME NOT NULL,
  independent_human_approval_attested BOOLEAN NOT NULL DEFAULT FALSE
    CHECK (NOT independent_human_approval_attested),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
REVOKE ALL ON greenfield_release_approval_decisions FROM PUBLIC, modula_api, modula_worker;

CREATE FUNCTION greenfield_release_approval_decision_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  authority_actor TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'release approval decisions are append-only' USING ERRCODE = '42501';
  END IF;
  authority_actor := public.greenfield_publisher_authority_actor('RELEASE_APPROVER');
  NEW.actor_account_id := authority_actor;
  NEW.actor_database_role := SESSION_USER::NAME;
  NEW.recorded_at := pg_catalog.clock_timestamp();
  NEW.independent_human_approval_attested := FALSE;
  IF NOT EXISTS (
    SELECT 1 FROM public.greenfield_publisher_release_jobs AS release_job
    WHERE release_job.job_id = NEW.job_id
      AND release_job.approval_sha256 = NEW.candidate_sha256
      AND release_job.approved_by_account_id = authority_actor
      AND release_job.approved_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'release approval decision does not match an authoritative transition'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER greenfield_release_approval_decision_guard
  BEFORE INSERT OR UPDATE OR DELETE ON greenfield_release_approval_decisions
  FOR EACH ROW EXECUTE FUNCTION greenfield_release_approval_decision_guard();

DROP FUNCTION greenfield_release_approver_record(TEXT, TEXT);
CREATE FUNCTION greenfield_release_approver_record(
  requested_job_id TEXT,
  expected_candidate_sha256 TEXT,
  requested_policy_id TEXT,
  requested_evidence_reference TEXT,
  requested_decision_source TEXT
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
  IF requested_policy_id !~ '^[A-Za-z0-9][A-Za-z0-9._:/@+-]{2,239}$'
     OR requested_evidence_reference !~ '^[A-Za-z0-9][A-Za-z0-9._:/@+-]{2,239}$'
     OR requested_decision_source NOT IN ('GOVERNANCE_DECISION', 'AUTOMATED_TEST_POLICY') THEN
    RAISE EXCEPTION 'release approval policy evidence is invalid' USING ERRCODE = '22023';
  END IF;
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
    RAISE EXCEPTION 'release facts are not eligible for authorized approval' USING ERRCODE = '42501';
  END IF;
  UPDATE public.greenfield_publisher_release_jobs
  SET approved_facts = release_job.approval_candidate_facts,
      approval_sha256 = release_job.approval_candidate_sha256,
      approved_at = pg_catalog.clock_timestamp(),
      approved_by_account_id = actor_id,
      approval_invalidated_at = NULL,
      approval_invalidated_by_account_id = NULL,
      approval_invalidation_reason = NULL,
      state = CASE WHEN EXISTS (
        SELECT 1 FROM public.greenfield_module_release_signatures AS signature_row
        WHERE signature_row.release_id = release_job.release_id
          AND signature_row.verification_state = 'pending'
      ) THEN 'signature_pending_verification' ELSE 'ready_for_signing' END,
      revision = revision + 1,
      updated_at = pg_catalog.clock_timestamp()
  WHERE job_id = requested_job_id;
  IF NOT public.greenfield_publisher_release_approved_facts_match(requested_job_id) THEN
    RAISE EXCEPTION 'approved release facts do not match the immutable registry release'
      USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.greenfield_release_approval_decisions (
    decision_id, job_id, candidate_sha256, policy_id, evidence_reference,
    decision_source, actor_account_id, actor_database_role
  ) VALUES (
    'prad_' || pg_catalog.gen_random_uuid()::TEXT, requested_job_id,
    expected_candidate_sha256, requested_policy_id, requested_evidence_reference,
    requested_decision_source, actor_id, SESSION_USER::NAME
  );
  RETURN release_job.approval_candidate_sha256;
END;
$$;
REVOKE ALL ON FUNCTION greenfield_release_approver_record(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

-- A provenance signature was produced outside the online signing provider, so
-- it must not receive an online-provider receipt.  The independent verifier
-- still records the verified evidence and audit event; this trigger only
-- prevents the legacy verifier function from fabricating identity-bound
-- receipt fields for an external signature.
CREATE FUNCTION greenfield_external_signature_receipt_normalize()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF OLD.state = 'signature_pending_verification'
     AND NEW.state IN ('ready_for_review', 'signature_invalid')
     AND OLD.signing_identity_id IS NULL
     AND public.greenfield_publisher_authority_has('TRUST_VERIFIER') THEN
    NEW.signing_receipt := NULL;
    NEW.signed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER greenfield_external_signature_receipt_normalize
  BEFORE UPDATE ON greenfield_publisher_release_jobs
  FOR EACH ROW EXECUTE FUNCTION greenfield_external_signature_receipt_normalize();

-- Publication failures are settled durably by the publication-only principal;
-- ordinary API and worker roles never receive queue mutation authority.
CREATE TABLE greenfield_publication_failure_events (
  failure_id TEXT PRIMARY KEY CHECK (failure_id ~ '^ppfe_[0-9a-f-]{36}$'),
  queue_job_id TEXT NOT NULL REFERENCES background_jobs(id),
  release_job_id TEXT NOT NULL REFERENCES greenfield_publisher_release_jobs(job_id),
  actor_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  actor_database_role NAME NOT NULL,
  attempt_count INTEGER NOT NULL CHECK (attempt_count > 0),
  maximum_attempts INTEGER NOT NULL CHECK (maximum_attempts > 0),
  disposition TEXT NOT NULL CHECK (disposition IN ('RETRYING', 'DEAD_LETTER')),
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL CHECK (pg_catalog.length(error_message) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
REVOKE ALL ON greenfield_publication_failure_events FROM PUBLIC, modula_api, modula_worker;

CREATE FUNCTION greenfield_publication_failure_history_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP <> 'INSERT' OR NOT public.greenfield_publisher_authority_has('PUBLICATION_AUTHORITY') THEN
    RAISE EXCEPTION 'publication failure history is immutable and authority-controlled' USING ERRCODE = '42501';
  END IF;
  NEW.actor_account_id := public.greenfield_publisher_authority_actor('PUBLICATION_AUTHORITY');
  NEW.actor_database_role := SESSION_USER::NAME;
  NEW.created_at := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER greenfield_publication_failure_history_guard
  BEFORE INSERT OR UPDATE OR DELETE ON greenfield_publication_failure_events
  FOR EACH ROW EXECUTE FUNCTION greenfield_publication_failure_history_guard();

CREATE OR REPLACE FUNCTION greenfield_publication_authority_publish_next()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  observed_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  selected RECORD;
  settled RECORD;
  release_identifier TEXT;
  failure_code TEXT;
  failure_message TEXT;
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
  IF NOT FOUND THEN RETURN NULL; END IF;

  BEGIN
    release_identifier := public.greenfield_publication_authority_publish(selected.job_id);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS failure_code = RETURNED_SQLSTATE, failure_message = MESSAGE_TEXT;
    observed_now := pg_catalog.clock_timestamp();
    UPDATE public.background_jobs
    SET status = CASE WHEN attempt_count + 1 >= maximum_attempts THEN 'DEAD_LETTER' ELSE 'RETRYING' END,
        attempt_count = attempt_count + 1,
        available_at = observed_now + CASE attempt_count WHEN 0 THEN INTERVAL '15 seconds' WHEN 1 THEN INTERVAL '30 seconds' ELSE INTERVAL '60 seconds' END,
        lease_owner = NULL, lease_expires_at = NULL,
        started_at = COALESCE(started_at, observed_now),
        finished_at = CASE WHEN attempt_count + 1 >= maximum_attempts THEN observed_now ELSE NULL END,
        completed_at = CASE WHEN attempt_count + 1 >= maximum_attempts THEN observed_now ELSE NULL END,
        updated_at = observed_now,
        last_error = pg_catalog.left(failure_message, 500),
        error_code = 'PUBLICATION_' || failure_code,
        error_class = 'PUBLISHER_RELEASE_PUBLICATION'
    WHERE id = selected.queue_job_id
    RETURNING attempt_count, maximum_attempts, status INTO settled;
    UPDATE public.greenfield_publisher_release_jobs
    SET state = CASE WHEN settled.status = 'DEAD_LETTER' THEN 'failed' ELSE state END,
        error = pg_catalog.jsonb_build_object(
          'code', CASE WHEN settled.status = 'DEAD_LETTER' THEN 'PUBLICATION_DEAD_LETTER' ELSE 'PUBLICATION_RETRY' END,
          'message', 'Publication authority did not complete the release transition'
        ),
        revision = revision + 1, updated_at = observed_now
    WHERE job_id = selected.job_id;
    INSERT INTO public.greenfield_publication_failure_events (
      failure_id, queue_job_id, release_job_id, actor_account_id,
      actor_database_role, attempt_count, maximum_attempts, disposition,
      error_code, error_message
    ) VALUES (
      'ppfe_' || pg_catalog.gen_random_uuid()::TEXT, selected.queue_job_id,
      selected.job_id, public.greenfield_publisher_authority_actor('PUBLICATION_AUTHORITY'),
      SESSION_USER::NAME, settled.attempt_count, settled.maximum_attempts,
      settled.status, failure_code, pg_catalog.left(failure_message, 500)
    );
    RETURN NULL;
  END;

  UPDATE public.background_jobs
  SET status = 'SUCCEEDED', lease_owner = NULL, lease_expires_at = NULL,
      attempt_count = attempt_count + 1, started_at = COALESCE(started_at, observed_now),
      finished_at = observed_now, completed_at = observed_now, updated_at = observed_now,
      last_error = NULL, error_code = NULL, error_class = NULL
  WHERE id = selected.queue_job_id;
  RETURN release_identifier;
END;
$$;
REVOKE ALL ON FUNCTION greenfield_publication_authority_publish_next() FROM PUBLIC;

CREATE OR REPLACE FUNCTION greenfield_revocation_authority_record(
  requested_scope TEXT,
  requested_target_id TEXT,
  requested_publisher_id TEXT,
  requested_reason TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id TEXT;
  clean_reason TEXT := pg_catalog.btrim(requested_reason);
  existing_row RECORD;
  revocation_id_value TEXT := 'mr_' || pg_catalog.gen_random_uuid()::TEXT;
  observed_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
BEGIN
  actor_id := public.greenfield_publisher_authority_actor('REVOCATION_AUTHORITY');
  IF requested_scope NOT IN ('release', 'module', 'publisher') THEN
    RAISE EXCEPTION 'unsupported revocation target type; signing keys require signing identity authority'
      USING ERRCODE = '22023';
  END IF;
  IF clean_reason IS NULL OR pg_catalog.length(clean_reason) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'revocation reason must contain 1 to 500 characters'
      USING ERRCODE = '22023';
  END IF;

  -- Transaction-scoped and key-scoped: unrelated revocations remain
  -- concurrent, while the first insert for one target becomes atomic.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    requested_scope || E'\x1f' || COALESCE(requested_target_id, ''),
    731420261126
  ));

  SELECT revocation.* INTO existing_row
  FROM public.greenfield_module_revocations AS revocation
  WHERE revocation.scope = requested_scope AND revocation.target_id = requested_target_id;
  IF FOUND THEN
    IF existing_row.publisher_id IS DISTINCT FROM requested_publisher_id
       OR existing_row.created_by IS DISTINCT FROM actor_id
       OR existing_row.reason IS DISTINCT FROM clean_reason THEN
      RAISE EXCEPTION 'revocation already exists with different immutable authority facts'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing_row.revocation_id;
  END IF;

  INSERT INTO public.greenfield_module_revocations (
    revocation_id, scope, target_id, publisher_id, reason,
    created_by, created_by_database_role, created_at
  ) VALUES (
    revocation_id_value, requested_scope, requested_target_id,
    requested_publisher_id, clean_reason, actor_id, SESSION_USER::NAME, observed_now
  );
  IF requested_scope = 'release' THEN
    UPDATE public.greenfield_module_releases
    SET release_state = 'revoked', revoked_at = observed_now, updated_at = observed_now
    WHERE release_id = requested_target_id AND publisher_id = requested_publisher_id;
  ELSIF requested_scope = 'publisher' THEN
    UPDATE public.greenfield_publishers
    SET status = 'revoked', revoked_at = observed_now, updated_at = observed_now
    WHERE publisher_id = requested_target_id;
  END IF;
  RETURN revocation_id_value;
END;
$$;

REVOKE ALL ON FUNCTION greenfield_revocation_authority_record(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '095')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = pg_catalog.clock_timestamp();
