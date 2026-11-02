-- GREENFIELD-FEATURE-REALITY-01 PR-05: server-backed named Saved collections and post drafts.

CREATE TABLE greenfield_saved_collections (
  collection_id TEXT PRIMARY KEY,
  owner_actor_id TEXT NOT NULL REFERENCES actors(id),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE UNIQUE INDEX greenfield_saved_collections_owner_name_unique
  ON greenfield_saved_collections (owner_actor_id, lower(name))
  WHERE deleted_at IS NULL;
CREATE INDEX greenfield_saved_collections_owner_list_idx
  ON greenfield_saved_collections (owner_actor_id, updated_at DESC, collection_id DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE greenfield_saved_collection_items (
  item_id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES greenfield_saved_collections(collection_id) ON DELETE CASCADE,
  save_id TEXT NOT NULL REFERENCES post_saves(id),
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (collection_id, save_id)
);

CREATE UNIQUE INDEX greenfield_saved_collection_items_position_unique
  ON greenfield_saved_collection_items (collection_id, position)
  WHERE deleted_at IS NULL;
CREATE INDEX greenfield_saved_collection_items_list_idx
  ON greenfield_saved_collection_items (collection_id, position ASC, item_id ASC)
  WHERE deleted_at IS NULL;

CREATE TABLE greenfield_post_drafts (
  draft_id TEXT PRIMARY KEY,
  owner_actor_id TEXT NOT NULL REFERENCES actors(id),
  idempotency_key TEXT,
  text TEXT NOT NULL DEFAULT '' CHECK (char_length(text) <= 5000),
  feed TEXT NOT NULL CHECK (feed IN ('following','forYou','modules')),
  audience TEXT NOT NULL CHECK (audience IN ('public','followers','private')),
  reply_permission TEXT NOT NULL CHECK (reply_permission IN ('everyone','followers','mentioned','none')),
  publish_to_atproto BOOLEAN NOT NULL DEFAULT FALSE,
  state TEXT NOT NULL DEFAULT 'editing' CHECK (state IN ('editing','published')),
  published_post_id TEXT REFERENCES posts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK ((state = 'editing' AND published_post_id IS NULL) OR (state = 'published' AND published_post_id IS NOT NULL))
);

CREATE UNIQUE INDEX greenfield_post_drafts_idempotency_unique
  ON greenfield_post_drafts (owner_actor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX greenfield_post_drafts_owner_list_idx
  ON greenfield_post_drafts (owner_actor_id, updated_at DESC, draft_id DESC)
  WHERE deleted_at IS NULL AND state = 'editing';

CREATE TABLE greenfield_post_draft_content (
  draft_id TEXT NOT NULL REFERENCES greenfield_post_drafts(draft_id) ON DELETE CASCADE,
  attachment_id TEXT NOT NULL REFERENCES attachments(attachment_id),
  content_type TEXT NOT NULL CHECK (content_type IN ('image','video','audio','pdf','document')),
  caption TEXT CHECK (caption IS NULL OR char_length(caption) <= 1000),
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (draft_id, attachment_id),
  UNIQUE (draft_id, position),
  UNIQUE (attachment_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  greenfield_saved_collections,
  greenfield_saved_collection_items,
  greenfield_post_drafts,
  greenfield_post_draft_content
TO modula_api;

GRANT SELECT ON
  greenfield_saved_collections,
  greenfield_saved_collection_items,
  greenfield_post_drafts,
  greenfield_post_draft_content
TO modula_worker, modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '086')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
