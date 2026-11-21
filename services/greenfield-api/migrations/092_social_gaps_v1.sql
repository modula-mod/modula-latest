-- 092: social gaps v1 — mark conversation unread, story reactions and story
-- highlights. Story viewer lists reuse greenfield_story_views (028).
--
-- Every feature here is additive and advertised through capability flags;
-- clients that never call the new routes see no behaviour change.

-- ---- mark conversation unread ------------------------------------------
-- Per-member manual unread marker. It never moves last_read_at, so read
-- receipts already seen by other members are not revoked. Reading the
-- conversation clears it.
ALTER TABLE greenfield_conversation_members
  ADD COLUMN marked_unread_at TIMESTAMPTZ;

-- ---- story reactions -----------------------------------------------------
CREATE TABLE greenfield_story_reactions (
  item_id TEXT NOT NULL REFERENCES greenfield_story_items(item_id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_id, actor_id)
);
CREATE INDEX greenfield_story_reactions_item_idx ON greenfield_story_reactions (item_id, updated_at DESC);

-- ---- story highlights ----------------------------------------------------
CREATE TABLE greenfield_story_highlights (
  highlight_id TEXT PRIMARY KEY,
  owner_actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 40),
  cover_item_id TEXT REFERENCES greenfield_story_items(item_id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX greenfield_story_highlights_owner_idx
  ON greenfield_story_highlights (owner_actor_id, sort_order, created_at)
  WHERE deleted_at IS NULL;

CREATE TABLE greenfield_story_highlight_items (
  highlight_id TEXT NOT NULL REFERENCES greenfield_story_highlights(highlight_id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES greenfield_story_items(item_id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (highlight_id, item_id)
);
CREATE INDEX greenfield_story_highlight_items_item_idx ON greenfield_story_highlight_items (item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  greenfield_story_reactions, greenfield_story_highlights, greenfield_story_highlight_items
  TO modula_api, modula_worker;
GRANT SELECT ON
  greenfield_story_reactions, greenfield_story_highlights, greenfield_story_highlight_items
  TO modula_backup;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '092')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
