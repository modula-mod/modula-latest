-- Phase 7I-F5B: allow moderation reports to target story items/groups.

ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_target_type_check;

ALTER TABLE reports
  ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('profile', 'post', 'story', 'message', 'other'));

INSERT INTO schema_metadata (key,value)
VALUES ('schema_version','036')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
