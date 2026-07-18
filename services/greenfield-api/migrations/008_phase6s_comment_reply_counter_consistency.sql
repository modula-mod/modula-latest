-- Phase 6S VPS repair: keep comment counters aligned with active source rows.
-- Tombstoned comments remain visible for thread continuity, but active counts
-- exclude rows with deleted_at set.

UPDATE greenfield_comments c
SET reply_count = counts.reply_count, updated_at = NOW()
FROM (
  SELECT
    c.comment_id,
    COALESCE((
      SELECT COUNT(*)
      FROM greenfield_comments r
      WHERE r.parent_comment_id = c.comment_id
        AND r.deleted_at IS NULL
    ), 0)::integer AS reply_count
  FROM greenfield_comments c
) counts
WHERE c.comment_id = counts.comment_id;

UPDATE posts p
SET reply_count = counts.comment_count, updated_at = NOW()
FROM (
  SELECT
    p.id,
    COALESCE((
      SELECT COUNT(*)
      FROM greenfield_comments c
      WHERE c.post_id = p.id
        AND c.deleted_at IS NULL
    ), 0)::integer AS comment_count
  FROM posts p
) counts
WHERE p.id = counts.id;

INSERT INTO schema_metadata (key,value)
VALUES ('schema_version','008')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
