-- Rich comments: pins, quotes, poll votes, and an admin-managed link blocklist. Additive only.
ALTER TABLE greenfield_comments
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS quoted_comment_id TEXT NULL;
CREATE INDEX IF NOT EXISTS greenfield_comments_pinned_idx
  ON greenfield_comments (post_id, pinned_at) WHERE pinned_at IS NOT NULL;

-- One vote per actor per poll comment; option_index refers to the poll item in comments.media.
CREATE TABLE IF NOT EXISTS greenfield_comment_poll_votes (
  comment_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  option_index SMALLINT NOT NULL CHECK (option_index BETWEEN 0 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, actor_id)
);
CREATE INDEX IF NOT EXISTS greenfield_comment_poll_votes_comment_idx ON greenfield_comment_poll_votes (comment_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_comment_poll_votes TO modula_api;
GRANT SELECT ON greenfield_comment_poll_votes TO modula_backup;

-- Known-bad domains flagged by the link safety check (managed by moderators).
CREATE TABLE IF NOT EXISTS greenfield_link_blocklist (
  domain TEXT PRIMARY KEY CHECK (domain = lower(domain) AND length(domain) <= 253),
  reason TEXT NOT NULL DEFAULT 'unsafe' CHECK (length(reason) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT ON greenfield_link_blocklist TO modula_api;
GRANT SELECT ON greenfield_link_blocklist TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '065')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
