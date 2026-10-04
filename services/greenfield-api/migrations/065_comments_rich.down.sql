DROP TABLE IF EXISTS greenfield_link_blocklist;
DROP TABLE IF EXISTS greenfield_comment_poll_votes;
DROP INDEX IF EXISTS greenfield_comments_pinned_idx;
ALTER TABLE greenfield_comments DROP COLUMN IF EXISTS quoted_comment_id;
ALTER TABLE greenfield_comments DROP COLUMN IF EXISTS pinned_at;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '064')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
