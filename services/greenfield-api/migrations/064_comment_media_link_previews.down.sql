DROP TABLE IF EXISTS greenfield_link_previews;
DROP INDEX IF EXISTS greenfield_comments_media_idx;
ALTER TABLE greenfield_comments DROP CONSTRAINT IF EXISTS greenfield_comments_media_check;
ALTER TABLE greenfield_comments DROP COLUMN IF EXISTS media;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '063')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
