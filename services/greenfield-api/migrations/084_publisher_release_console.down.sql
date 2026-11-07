UPDATE background_jobs SET status = 'CANCELLED', dispatch_mode = 'GREENFIELD_WORKER', updated_at = NOW()
  WHERE dispatch_mode = 'PUBLISHER_RELEASE_RUNNER' AND status IN ('QUEUED', 'RETRYING', 'LEASED', 'RUNNING');
UPDATE background_jobs SET dispatch_mode = 'GREENFIELD_WORKER' WHERE dispatch_mode = 'PUBLISHER_RELEASE_RUNNER';
ALTER TABLE background_jobs DROP CONSTRAINT IF EXISTS background_jobs_dispatch_mode_check;
ALTER TABLE background_jobs ADD CONSTRAINT background_jobs_dispatch_mode_check
  CHECK (dispatch_mode IN ('GREENFIELD_WORKER', 'SERVICE_PULL'));
DROP TABLE IF EXISTS greenfield_publisher_release_job_logs;
DROP FUNCTION IF EXISTS greenfield_publisher_release_job_logs_append_only();
DROP TABLE IF EXISTS greenfield_publisher_release_jobs;
DROP FUNCTION IF EXISTS greenfield_publisher_release_jobs_published_terminal();

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '083')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
