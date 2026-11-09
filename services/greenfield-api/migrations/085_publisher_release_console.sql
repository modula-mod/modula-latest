-- BUILDER-01: publisher Module Release Console jobs.
-- Generic publisher release jobs over the existing registry (no registry rebuild).
-- Stores only public facts, digests, verification evidence and logs. Never stores
-- publisher private keys or signing material. Additive only.

CREATE TABLE IF NOT EXISTS greenfield_publisher_release_jobs (
  job_id TEXT PRIMARY KEY CHECK (job_id ~ '^prj_[0-9a-f-]{36}$'),
  module_id TEXT NOT NULL CHECK (length(module_id) BETWEEN 3 AND 180),
  publisher_id TEXT NOT NULL REFERENCES greenfield_publishers(publisher_id),
  created_by_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  source_repository TEXT NOT NULL CHECK (source_repository ~ '^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$'),
  release_tag TEXT NOT NULL CHECK (length(release_tag) BETWEEN 1 AND 200),
  source_commit TEXT CHECK (source_commit IS NULL OR source_commit ~ '^[0-9a-f]{40}$'),
  version TEXT CHECK (version IS NULL OR length(version) BETWEEN 1 AND 80),
  channel TEXT CHECK (channel IS NULL OR channel IN ('stable', 'beta', 'rc', 'dev')),
  artifact_sha256 TEXT CHECK (artifact_sha256 IS NULL OR artifact_sha256 ~ '^[0-9a-f]{64}$'),
  release_id TEXT,
  state TEXT NOT NULL DEFAULT 'created' CHECK (state IN (
    'created', 'fetching', 'validating', 'signature_missing', 'signature_invalid', 'signature_verified',
    'validation_failed', 'ready_for_review', 'publishing', 'published', 'cancelled', 'failed', 'conflicted'
  )),
  cancelled_from_state TEXT CHECK (cancelled_from_state IS NULL OR cancelled_from_state IN (
    'created', 'fetching', 'validating', 'signature_verified', 'ready_for_review', 'publishing',
    'signature_missing', 'signature_invalid', 'validation_failed', 'failed'
  )),
  preview JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(preview) = 'object'),
  signature JSONB NOT NULL DEFAULT '{"state":"pending"}'::jsonb CHECK (jsonb_typeof(signature) = 'object'),
  validation JSONB NOT NULL DEFAULT '{"passed":false,"checks":[]}'::jsonb CHECK (jsonb_typeof(validation) = 'object'),
  permission_delta JSONB CHECK (permission_delta IS NULL OR jsonb_typeof(permission_delta) = 'object'),
  permission_change_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  error JSONB CHECK (error IS NULL OR jsonb_typeof(error) = 'object'),
  idempotency_key TEXT CHECK (idempotency_key IS NULL OR length(idempotency_key) BETWEEN 1 AND 180),
  publish_requested_by_account_id TEXT REFERENCES greenfield_accounts(account_id),
  publish_started_at TIMESTAMPTZ,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  CHECK ((state = 'published') = (published_at IS NOT NULL)),
  CHECK (state <> 'published' OR (version IS NOT NULL AND artifact_sha256 IS NOT NULL AND source_commit IS NOT NULL AND release_id IS NOT NULL)),
  CHECK ((state = 'cancelled') = (cancelled_at IS NOT NULL)),
  -- Private key material is never accepted into any job column.
  CHECK (position('PRIVATE KEY' in preview::text) = 0 AND position('PRIVATE KEY' in signature::text) = 0)
);

-- Concurrency: one in-flight job per moduleId + releaseTag and per moduleId@version.
CREATE UNIQUE INDEX IF NOT EXISTS greenfield_publisher_release_jobs_inflight_tag_idx
  ON greenfield_publisher_release_jobs (module_id, release_tag)
  WHERE state IN ('created', 'fetching', 'validating', 'signature_verified', 'ready_for_review', 'publishing');
CREATE UNIQUE INDEX IF NOT EXISTS greenfield_publisher_release_jobs_inflight_version_idx
  ON greenfield_publisher_release_jobs (module_id, version)
  WHERE version IS NOT NULL AND state IN ('created', 'fetching', 'validating', 'signature_verified', 'ready_for_review', 'publishing');
-- Immutability: at most one published job per moduleId@version.
CREATE UNIQUE INDEX IF NOT EXISTS greenfield_publisher_release_jobs_published_version_idx
  ON greenfield_publisher_release_jobs (module_id, version)
  WHERE state = 'published';
-- Idempotency-Key replay is scoped to the module.
CREATE UNIQUE INDEX IF NOT EXISTS greenfield_publisher_release_jobs_idempotency_idx
  ON greenfield_publisher_release_jobs (module_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS greenfield_publisher_release_jobs_module_idx
  ON greenfield_publisher_release_jobs (module_id, created_at DESC);
CREATE INDEX IF NOT EXISTS greenfield_publisher_release_jobs_natural_key_idx
  ON greenfield_publisher_release_jobs (module_id, version, release_tag, artifact_sha256);

-- Published is terminal: a published job can never change state again.
CREATE OR REPLACE FUNCTION greenfield_publisher_release_jobs_published_terminal() RETURNS trigger AS $$
BEGIN
  IF OLD.state = 'published' AND (NEW.state <> 'published' OR NEW.version IS DISTINCT FROM OLD.version
      OR NEW.artifact_sha256 IS DISTINCT FROM OLD.artifact_sha256 OR NEW.release_id IS DISTINCT FROM OLD.release_id) THEN
    RAISE EXCEPTION 'published publisher release jobs are terminal';
  END IF;
  IF NEW.state = 'published' AND OLD.state <> 'publishing' THEN
    RAISE EXCEPTION 'publisher release jobs can only become published from publishing';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS greenfield_publisher_release_jobs_published_terminal ON greenfield_publisher_release_jobs;
CREATE TRIGGER greenfield_publisher_release_jobs_published_terminal BEFORE UPDATE ON greenfield_publisher_release_jobs
  FOR EACH ROW EXECUTE FUNCTION greenfield_publisher_release_jobs_published_terminal();

-- Append-only, timestamped job log.
CREATE TABLE IF NOT EXISTS greenfield_publisher_release_job_logs (
  log_id BIGSERIAL PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES greenfield_publisher_release_jobs(job_id),
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  step TEXT CHECK (step IS NULL OR length(step) <= 80),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS greenfield_publisher_release_job_logs_job_idx
  ON greenfield_publisher_release_job_logs (job_id, log_id);

CREATE OR REPLACE FUNCTION greenfield_publisher_release_job_logs_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'greenfield_publisher_release_job_logs is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS greenfield_publisher_release_job_logs_append_only ON greenfield_publisher_release_job_logs;
CREATE TRIGGER greenfield_publisher_release_job_logs_append_only BEFORE UPDATE OR DELETE ON greenfield_publisher_release_job_logs
  FOR EACH ROW EXECUTE FUNCTION greenfield_publisher_release_job_logs_append_only();

-- Console work runs on the existing background_jobs queue under a dedicated
-- dispatch mode so it is executed by the publisher release runner (which owns
-- the registry release services) and never by the generic greenfield-worker.
ALTER TABLE background_jobs DROP CONSTRAINT IF EXISTS background_jobs_dispatch_mode_check;
ALTER TABLE background_jobs ADD CONSTRAINT background_jobs_dispatch_mode_check
  CHECK (dispatch_mode IN ('GREENFIELD_WORKER', 'SERVICE_PULL', 'PUBLISHER_RELEASE_RUNNER'));

GRANT SELECT, INSERT, UPDATE ON greenfield_publisher_release_jobs TO modula_api;
GRANT SELECT, INSERT ON greenfield_publisher_release_job_logs TO modula_api;
GRANT USAGE, SELECT ON SEQUENCE greenfield_publisher_release_job_logs_log_id_seq TO modula_api;
GRANT SELECT ON greenfield_publisher_release_jobs, greenfield_publisher_release_job_logs TO modula_worker, modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '085')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
