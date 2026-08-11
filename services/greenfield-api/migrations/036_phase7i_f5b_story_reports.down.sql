UPDATE reports
SET target_type = 'other'
WHERE target_type = 'story';

ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_target_type_check;

ALTER TABLE reports
  ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('profile', 'post', 'message', 'other'));

UPDATE schema_metadata
SET value = '035', updated_at = NOW()
WHERE key = 'schema_version';
