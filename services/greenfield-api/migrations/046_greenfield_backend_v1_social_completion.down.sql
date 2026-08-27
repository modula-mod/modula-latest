INSERT INTO post_likes (id, actor_id, post_id, created_at, updated_at, deleted_at, version)
SELECT 'legacy-like-' || reaction_id, actor_id, post_id, created_at, updated_at, NULL, 1
FROM greenfield_reactions
WHERE reaction_type = 'like'
ON CONFLICT (actor_id, post_id) DO UPDATE SET
  deleted_at = NULL,
  updated_at = EXCLUDED.updated_at,
  version = post_likes.version + 1;

UPDATE posts p SET
  like_count = (SELECT count(*)::integer FROM post_likes l WHERE l.post_id = p.id AND l.deleted_at IS NULL),
  updated_at = NOW();

DROP TABLE IF EXISTS greenfield_post_shares;

DROP INDEX IF EXISTS reports_review_queue_idx;
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_review_state_check;
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_evidence_refs_array_check;
ALTER TABLE reports
  DROP COLUMN IF EXISTS resolution,
  DROP COLUMN IF EXISTS reviewed_at,
  DROP COLUMN IF EXISTS reviewed_by_actor_id,
  DROP COLUMN IF EXISTS evidence_refs;

UPDATE reports SET target_type='other' WHERE target_type='comment';
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE reports ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('profile', 'post', 'story', 'message', 'other'));

UPDATE schema_metadata SET value='045', updated_at=NOW() WHERE key='schema_version';
