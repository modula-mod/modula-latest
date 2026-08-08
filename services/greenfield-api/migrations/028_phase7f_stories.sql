-- Phase 7F-B: Stories domain (24h ephemeral media groups).
CREATE TABLE greenfield_story_groups (
  group_id TEXT PRIMARY KEY,
  owner_actor_id TEXT NOT NULL REFERENCES actors(id),
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'followers', 'close')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX greenfield_story_groups_owner_idx ON greenfield_story_groups(owner_actor_id, expires_at DESC);
CREATE INDEX greenfield_story_groups_active_idx ON greenfield_story_groups(expires_at) WHERE deleted_at IS NULL;

CREATE TABLE greenfield_story_items (
  item_id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES greenfield_story_groups(group_id) ON DELETE CASCADE,
  media_kind TEXT NOT NULL CHECK (media_kind IN ('image', 'video')),
  media_url TEXT,
  media_file_name TEXT,
  caption TEXT CHECK (caption IS NULL OR char_length(caption) <= 500),
  status TEXT NOT NULL CHECK (status IN ('uploading', 'ready', 'failed')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX greenfield_story_items_group_idx ON greenfield_story_items(group_id, sort_order);

CREATE TABLE greenfield_story_views (
  view_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES greenfield_story_items(item_id) ON DELETE CASCADE,
  viewer_actor_id TEXT NOT NULL REFERENCES actors(id),
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, viewer_actor_id)
);
CREATE INDEX greenfield_story_views_viewer_idx ON greenfield_story_views(viewer_actor_id, viewed_at DESC);

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '028')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
