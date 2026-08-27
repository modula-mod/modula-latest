-- Greenfield Backend V1: Social truth, moderation workflow and share ledger.

-- Legacy one-tap likes now converge into the canonical one-reaction-per-target
-- ledger. An existing expressive reaction wins over a legacy like.
INSERT INTO greenfield_reactions (reaction_id, actor_id, post_id, reaction_type, created_at, updated_at)
SELECT 'reaction-' || id, actor_id, post_id, 'like', created_at, updated_at
FROM post_likes
WHERE deleted_at IS NULL
ON CONFLICT (actor_id, post_id) DO NOTHING;

UPDATE post_likes
SET deleted_at = COALESCE(deleted_at, NOW()), updated_at = NOW(), version = version + 1
WHERE deleted_at IS NULL;

UPDATE posts p SET
  reaction_count = (SELECT count(*)::integer FROM greenfield_reactions r WHERE r.post_id = p.id),
  like_count = (SELECT count(*)::integer FROM greenfield_reactions r WHERE r.post_id = p.id AND r.reaction_type = 'like'),
  updated_at = NOW();

ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE reports
  ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('profile', 'post', 'comment', 'story', 'message', 'other'));

ALTER TABLE reports
  ADD COLUMN evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN reviewed_by_actor_id TEXT REFERENCES actors(id),
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN resolution TEXT;

-- Earlier releases stored terminal state without reviewer provenance. Preserve
-- that truth explicitly; all new terminal transitions record the operator.
UPDATE reports
SET reviewed_at = updated_at,
    resolution = 'Legacy terminal state migrated; reviewer provenance unavailable'
WHERE status IN ('resolved', 'dismissed');

ALTER TABLE reports
  ADD CONSTRAINT reports_evidence_refs_array_check CHECK (jsonb_typeof(evidence_refs) = 'array'),
  ADD CONSTRAINT reports_review_state_check CHECK (
    (status IN ('open', 'reviewing') AND reviewed_at IS NULL)
    OR (status IN ('resolved', 'dismissed') AND reviewed_at IS NOT NULL)
  );

CREATE INDEX reports_review_queue_idx
  ON reports(status, created_at ASC)
  WHERE deleted_at IS NULL;

CREATE TABLE greenfield_post_shares (
  share_id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('copy-link', 'native', 'direct', 'external')),
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX greenfield_post_shares_idempotency_unique
  ON greenfield_post_shares(actor_id, post_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX greenfield_post_shares_actor_idx
  ON greenfield_post_shares(actor_id, created_at DESC);
CREATE INDEX greenfield_post_shares_post_idx
  ON greenfield_post_shares(post_id, created_at DESC);

GRANT SELECT, INSERT ON greenfield_post_shares TO modula_api;
GRANT SELECT ON greenfield_post_shares TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '046')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
