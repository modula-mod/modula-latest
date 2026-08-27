-- Greenfield Backend V1: canonical event provenance and job lifecycle.
-- Evolves the existing domain-event and background-job ledgers in place.

ALTER TABLE greenfield_domain_events
  ADD COLUMN producer_kind TEXT NOT NULL DEFAULT 'service'
    CHECK (producer_kind IN ('platform','product','service','connector','user')),
  ADD COLUMN producer_id TEXT NOT NULL DEFAULT 'service.greenfield-api',
  ADD COLUMN product_id TEXT,
  ADD COLUMN installation_id TEXT,
  ADD COLUMN release_id TEXT,
  ADD COLUMN trace_id TEXT;

UPDATE greenfield_domain_events
SET trace_id = COALESCE(correlation_id, request_id, event_id)
WHERE trace_id IS NULL;

ALTER TABLE greenfield_domain_events
  ALTER COLUMN trace_id SET NOT NULL;

CREATE INDEX greenfield_domain_events_producer_idx
  ON greenfield_domain_events(producer_kind, producer_id, occurred_at DESC);
CREATE INDEX greenfield_domain_events_product_idx
  ON greenfield_domain_events(account_id, product_id, installation_id, occurred_at DESC)
  WHERE product_id IS NOT NULL;
CREATE INDEX greenfield_domain_events_trace_idx
  ON greenfield_domain_events(trace_id);

CREATE OR REPLACE FUNCTION greenfield_event_scope_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF length(NEW.producer_id) < 1 OR length(NEW.producer_id) > 180
     OR length(NEW.trace_id) < 1 OR length(NEW.trace_id) > 240 THEN
    RAISE EXCEPTION 'event producer and trace identifiers must be bounded';
  END IF;
  IF NEW.product_id IS NULL AND (NEW.installation_id IS NOT NULL OR NEW.release_id IS NOT NULL) THEN
    RAISE EXCEPTION 'event installation and release require a product';
  END IF;
  IF NEW.release_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM greenfield_module_releases release
    WHERE release.release_id = NEW.release_id
      AND release.module_id = NEW.product_id
  ) THEN
    RAISE EXCEPTION 'event release does not match its product';
  END IF;
  IF NEW.installation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM greenfield_extension_installations installation
    JOIN greenfield_module_releases release
      ON release.extension_version_id = installation.extension_version_id
    WHERE installation.installation_id = NEW.installation_id
      AND installation.account_id = NEW.account_id
      AND release.module_id = NEW.product_id
      AND (NEW.release_id IS NULL OR release.release_id = NEW.release_id)
  ) THEN
    RAISE EXCEPTION 'event scope does not match its account, product, installation and release';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER greenfield_domain_events_scope_guard
  BEFORE INSERT OR UPDATE OF account_id, product_id, installation_id, release_id, producer_id, trace_id
  ON greenfield_domain_events
  FOR EACH ROW EXECUTE FUNCTION greenfield_event_scope_guard();

ALTER TABLE background_jobs
  DROP CONSTRAINT background_jobs_status_check;

UPDATE background_jobs
SET status = CASE status
  WHEN 'pending' THEN 'QUEUED'
  WHEN 'leased' THEN 'LEASED'
  WHEN 'completed' THEN 'SUCCEEDED'
  WHEN 'failed' THEN 'FAILED'
  WHEN 'dead_letter' THEN 'DEAD_LETTER'
  ELSE status
END;

ALTER TABLE background_jobs
  ADD CONSTRAINT background_jobs_status_check
  CHECK (status IN ('QUEUED','LEASED','RUNNING','RETRYING','SUCCEEDED','FAILED','CANCELLED','DEAD_LETTER')),
  ADD COLUMN owner_type TEXT NOT NULL DEFAULT 'platform'
    CHECK (owner_type IN ('platform','account','organisation','product','installation')),
  ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'platform',
  ADD COLUMN owner_account_id TEXT REFERENCES greenfield_accounts(account_id) ON DELETE SET NULL,
  ADD COLUMN product_id TEXT,
  ADD COLUMN installation_id TEXT,
  ADD COLUMN release_id TEXT,
  ADD COLUMN action TEXT,
  ADD COLUMN service_id TEXT NOT NULL DEFAULT 'service.greenfield-worker',
  ADD COLUMN dispatch_mode TEXT NOT NULL DEFAULT 'GREENFIELD_WORKER'
    CHECK (dispatch_mode IN ('GREENFIELD_WORKER','SERVICE_PULL')),
  ADD COLUMN timeout_ms INTEGER NOT NULL DEFAULT 30000 CHECK (timeout_ms BETWEEN 1000 AND 900000),
  ADD COLUMN idempotency_key TEXT CHECK (idempotency_key IS NULL OR length(idempotency_key) BETWEEN 1 AND 180),
  ADD COLUMN trace_id TEXT,
  ADD COLUMN started_at TIMESTAMPTZ,
  ADD COLUMN finished_at TIMESTAMPTZ,
  ADD COLUMN result_reference TEXT CHECK (
    result_reference IS NULL OR (
      length(result_reference) <= 500
      AND result_reference ~ '^(greenfield|storage|object|service|artifact)://[A-Za-z0-9._:/-]+$'
    )
  ),
  ADD COLUMN error_class TEXT,
  ADD COLUMN error_code TEXT;

UPDATE background_jobs
SET action = job_type,
    trace_id = id,
    started_at = CASE WHEN status IN ('SUCCEEDED','FAILED','DEAD_LETTER') THEN created_at ELSE NULL END,
    finished_at = CASE WHEN status IN ('SUCCEEDED','FAILED','DEAD_LETTER') THEN COALESCE(completed_at, updated_at) ELSE NULL END,
    error_class = CASE WHEN last_error IS NOT NULL THEN 'LEGACY_JOB_FAILURE' ELSE NULL END,
    last_error = CASE WHEN last_error IS NOT NULL THEN 'Legacy job failure detail redacted during schema 043' ELSE NULL END;

ALTER TABLE background_jobs
  ALTER COLUMN action SET NOT NULL,
  ALTER COLUMN trace_id SET NOT NULL;

DROP INDEX background_jobs_claim_idx;
DROP INDEX background_jobs_lease_idx;
CREATE INDEX background_jobs_claim_idx
  ON background_jobs(dispatch_mode, status, available_at, priority, created_at)
  WHERE status IN ('QUEUED','RETRYING');
CREATE INDEX background_jobs_lease_idx
  ON background_jobs(lease_owner, lease_expires_at)
  WHERE status IN ('LEASED','RUNNING');
CREATE INDEX background_jobs_scope_idx
  ON background_jobs(owner_account_id, product_id, installation_id, created_at DESC)
  WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX background_jobs_service_idempotency_idx
  ON background_jobs(owner_account_id, product_id, installation_id, action, idempotency_key)
  WHERE dispatch_mode = 'SERVICE_PULL' AND idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION greenfield_job_scope_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF length(NEW.owner_id) < 1 OR length(NEW.owner_id) > 240
     OR length(NEW.action) < 1 OR length(NEW.action) > 240
     OR length(NEW.service_id) < 1 OR length(NEW.service_id) > 180
     OR length(NEW.trace_id) < 1 OR length(NEW.trace_id) > 240 THEN
    RAISE EXCEPTION 'job owner, action, service and trace identifiers must be bounded';
  END IF;
  IF NEW.dispatch_mode = 'SERVICE_PULL' THEN
    IF NEW.owner_type <> 'account' OR NEW.owner_account_id IS NULL
       OR NEW.owner_id <> NEW.owner_account_id OR NEW.product_id IS NULL
       OR NEW.installation_id IS NULL OR NEW.release_id IS NULL
       OR NEW.idempotency_key IS NULL THEN
      RAISE EXCEPTION 'service-pull jobs require complete account, product, installation, release and idempotency scope';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM greenfield_extension_installations installation
      JOIN greenfield_module_releases release
        ON release.extension_version_id = installation.extension_version_id
      WHERE installation.installation_id = NEW.installation_id
        AND installation.account_id = NEW.owner_account_id
        AND release.module_id = NEW.product_id
        AND release.release_id = NEW.release_id
    ) THEN
      RAISE EXCEPTION 'job scope does not match its account, product, installation and release';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM greenfield_module_job_registrations registration
      WHERE registration.installation_id = NEW.installation_id
        AND registration.account_id = NEW.owner_account_id
        AND registration.release_id = NEW.release_id
        AND registration.module_id = NEW.product_id
        AND registration.job_key = NEW.action
        AND registration.paused = FALSE
        AND registration.status = 'registered'
    ) THEN
      RAISE EXCEPTION 'service-pull job action is not an active installed release declaration';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM greenfield_module_service_registrations service
      WHERE service.installation_id = NEW.installation_id
        AND service.account_id = NEW.owner_account_id
        AND service.release_id = NEW.release_id
        AND service.module_id = NEW.product_id
        AND service.service_id = NEW.service_id
        AND service.status = 'registered'
        AND service.health_state IN ('healthy','degraded')
    ) THEN
      RAISE EXCEPTION 'service-pull job target is not an active registered service';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER background_jobs_scope_guard
  BEFORE INSERT OR UPDATE OF owner_type, owner_id, owner_account_id, product_id, installation_id, release_id, action, service_id, dispatch_mode, idempotency_key, trace_id
  ON background_jobs
  FOR EACH ROW EXECUTE FUNCTION greenfield_job_scope_guard();

ALTER TABLE job_failures
  ADD COLUMN payload_fingerprint TEXT,
  ADD COLUMN error_class TEXT;

UPDATE job_failures
SET payload_fingerprint = 'legacy-md5:' || md5(payload::text),
    error_class = error_code,
    payload = '{}'::jsonb,
    error_message = 'Legacy job failure detail redacted during schema 043';

ALTER TABLE job_failures
  ALTER COLUMN payload SET DEFAULT '{}'::jsonb,
  ALTER COLUMN payload_fingerprint SET NOT NULL,
  ADD CONSTRAINT job_failures_payload_redacted_check CHECK (payload = '{}'::jsonb),
  ADD CONSTRAINT job_failures_payload_fingerprint_check CHECK (
    payload_fingerprint ~ '^(legacy-md5:[a-f0-9]{32}|sha256:[a-f0-9]{64})$'
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON background_jobs, job_failures TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_domain_events TO modula_api, modula_worker;
GRANT SELECT ON background_jobs, job_failures, greenfield_domain_events TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '043')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
