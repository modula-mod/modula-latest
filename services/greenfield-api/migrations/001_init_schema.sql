-- Purpose: initial Modula social schema, roles grants foundation, RLS
-- Forward: create tables + RLS policies
-- Rollback: 001_init_schema.down.sql
-- Lock impact: CREATE TABLE / ALTER TABLE (low on empty DB)
-- Backup requirement: yes before production apply


CREATE TABLE IF NOT EXISTS schema_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE actors (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('person', 'team', 'organisation', 'service')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL UNIQUE REFERENCES actors(id),
  handle TEXT NOT NULL,
  display_name TEXT NOT NULL CHECK (char_length(btrim(display_name)) > 0),
  kind TEXT NOT NULL CHECK (kind IN ('person', 'creator', 'professional', 'organisation', 'team')),
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  cover_url TEXT,
  cover_colour TEXT,
  pronouns TEXT,
  location_label TEXT,
  location_visibility TEXT CHECK (location_visibility IS NULL OR location_visibility IN ('public', 'followers', 'teams', 'private')),
  website_label TEXT,
  website_url TEXT,
  website_domain TEXT,
  website_visibility TEXT CHECK (website_visibility IS NULL OR website_visibility IN ('public', 'followers', 'teams', 'private')),
  focus_status_id TEXT NOT NULL,
  focus_status_label TEXT NOT NULL,
  focus_status_message TEXT NOT NULL,
  focus_status_updated_at TIMESTAMPTZ NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'followers', 'teams', 'private')),
  module_count INTEGER NOT NULL DEFAULT 0 CHECK (module_count >= 0),
  featured_module_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  identity_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  joined_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE UNIQUE INDEX profiles_handle_canonical_uidx ON profiles (lower(handle)) WHERE deleted_at IS NULL;

CREATE TABLE profile_links (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'followers', 'teams', 'private')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  author_actor_id TEXT NOT NULL REFERENCES actors(id),
  kind TEXT NOT NULL CHECK (kind IN ('text', 'media', 'link', 'module')),
  text TEXT CHECK (text IS NULL OR char_length(text) <= 5000),
  feed TEXT NOT NULL CHECK (feed IN ('following', 'forYou', 'modules')),
  audience TEXT NOT NULL CHECK (audience IN ('public', 'followers', 'private')),
  reply_permission TEXT NOT NULL CHECK (reply_permission IN ('everyone', 'followers', 'mentioned', 'none')),
  idempotency_key TEXT,
  link_domain TEXT,
  link_title TEXT,
  link_description TEXT,
  link_image TEXT,
  module_name TEXT,
  module_action_label TEXT,
  module_status TEXT,
  glow_colour TEXT,
  like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  reply_count INTEGER NOT NULL DEFAULT 0 CHECK (reply_count >= 0),
  repost_count INTEGER NOT NULL DEFAULT 0 CHECK (repost_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (author_actor_id, idempotency_key)
);

CREATE TABLE post_media (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  kind TEXT NOT NULL CHECK (kind IN ('image')),
  url TEXT,
  title TEXT,
  colour TEXT,
  aspect_ratio TEXT,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE follows (
  id TEXT PRIMARY KEY,
  follower_actor_id TEXT NOT NULL REFERENCES actors(id),
  followed_actor_id TEXT NOT NULL REFERENCES actors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT follows_not_self CHECK (follower_actor_id <> followed_actor_id),
  UNIQUE (follower_actor_id, followed_actor_id)
);

CREATE TABLE post_likes (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  post_id TEXT NOT NULL REFERENCES posts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (actor_id, post_id)
);

CREATE TABLE post_saves (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  post_id TEXT NOT NULL REFERENCES posts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (actor_id, post_id)
);

CREATE TABLE post_reposts (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  post_id TEXT NOT NULL REFERENCES posts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (actor_id, post_id)
);

CREATE TABLE idempotency_keys (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (actor_id, key)
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE outbox_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE TABLE activity_items (
  id TEXT PRIMARY KEY,
  group_key TEXT NOT NULL,
  type TEXT NOT NULL,
  actor_id TEXT REFERENCES actors(id),
  icon TEXT,
  description TEXT NOT NULL,
  preview TEXT,
  action_label TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE reels (
  id TEXT PRIMARY KEY,
  author_actor_id TEXT NOT NULL REFERENCES actors(id),
  caption TEXT NOT NULL,
  source TEXT NOT NULL,
  colour TEXT NOT NULL,
  like_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE trending_topics (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  post_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE featured_modules (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

INSERT INTO schema_metadata (key, value) VALUES
  ('schema_version', '001'),
  ('seed_version', 'none')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- RLS foundation
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts FORCE ROW LEVEL SECURITY;
ALTER TABLE post_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_saves FORCE ROW LEVEL SECURITY;
ALTER TABLE profile_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_links FORCE ROW LEVEL SECURITY;

CREATE POLICY profiles_public_read ON profiles
  FOR SELECT
  USING (deleted_at IS NULL AND visibility = 'public');

CREATE POLICY posts_public_read ON posts
  FOR SELECT
  USING (deleted_at IS NULL AND audience = 'public');

CREATE POLICY profile_links_public_read ON profile_links
  FOR SELECT
  USING (deleted_at IS NULL AND visibility = 'public');

-- Saves are private: no public SELECT policy for anon/public role.
-- Runtime API role uses BYPASSRLS? No — grant SELECT only via policy for owner.
-- Without actor context in Phase 5, API reads saves only through service queries as table owner/migrator during seed;
-- runtime role has no SELECT on post_saves.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'modula_api') THEN
    GRANT USAGE ON SCHEMA public TO modula_api;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO modula_api;
    REVOKE SELECT ON post_saves FROM modula_api;
    GRANT SELECT, INSERT ON audit_events TO modula_api;
    GRANT SELECT, INSERT ON outbox_events TO modula_api;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'modula_readonly') THEN
    GRANT USAGE ON SCHEMA public TO modula_readonly;
    GRANT SELECT ON profiles, posts, actors, reels, activity_items, trending_topics, featured_modules, schema_metadata TO modula_readonly;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'modula_backup') THEN
    GRANT USAGE ON SCHEMA public TO modula_backup;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO modula_backup;
  END IF;
END $$;
