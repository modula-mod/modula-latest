-- Purpose: Phase 6 sessions, social ops, jobs, AT Protocol bridge
-- Forward: create tables + grants + search indexes
-- Rollback: 002_phase6_social_atproto.down.sql
-- Lock impact: CREATE TABLE / CREATE INDEX
-- Backup requirement: yes before production apply

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'revoked', 'suspended')),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE INDEX sessions_actor_id_idx ON sessions (actor_id) WHERE status = 'active';
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE session_capabilities (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, capability)
);

CREATE INDEX session_capabilities_session_idx ON session_capabilities (session_id) WHERE revoked_at IS NULL;

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  recipient_actor_id TEXT NOT NULL REFERENCES actors(id),
  actor_id TEXT REFERENCES actors(id),
  type TEXT NOT NULL CHECK (type IN ('follow', 'like', 'repost', 'reply', 'mention', 'module_event')),
  resource_type TEXT,
  resource_id TEXT,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE INDEX notifications_recipient_created_idx ON notifications (recipient_actor_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX notifications_recipient_unread_idx ON notifications (recipient_actor_id)
  WHERE deleted_at IS NULL AND read_at IS NULL;

CREATE TABLE notification_preferences (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL UNIQUE REFERENCES actors(id),
  follow_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  like_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  repost_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  reply_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  mention_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  module_event_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE blocks (
  id TEXT PRIMARY KEY,
  blocker_actor_id TEXT NOT NULL REFERENCES actors(id),
  blocked_actor_id TEXT NOT NULL REFERENCES actors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT blocks_not_self CHECK (blocker_actor_id <> blocked_actor_id),
  UNIQUE (blocker_actor_id, blocked_actor_id)
);

CREATE INDEX blocks_blocker_idx ON blocks (blocker_actor_id) WHERE deleted_at IS NULL;
CREATE INDEX blocks_blocked_idx ON blocks (blocked_actor_id) WHERE deleted_at IS NULL;

CREATE TABLE mutes (
  id TEXT PRIMARY KEY,
  muter_actor_id TEXT NOT NULL REFERENCES actors(id),
  muted_actor_id TEXT NOT NULL REFERENCES actors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT mutes_not_self CHECK (muter_actor_id <> muted_actor_id),
  UNIQUE (muter_actor_id, muted_actor_id)
);

CREATE INDEX mutes_muter_idx ON mutes (muter_actor_id) WHERE deleted_at IS NULL;

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_actor_id TEXT NOT NULL REFERENCES actors(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('profile', 'post', 'message', 'other')),
  target_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('spam', 'harassment', 'impersonation', 'illegal-content', 'privacy', 'other')),
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE INDEX reports_reporter_idx ON reports (reporter_actor_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX reports_status_idx ON reports (status) WHERE deleted_at IS NULL;

CREATE TABLE moderation_actions (
  id TEXT PRIMARY KEY,
  report_id TEXT REFERENCES reports(id),
  actor_id TEXT REFERENCES actors(id),
  action_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE background_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'leased', 'completed', 'failed', 'dead_letter')),
  priority INTEGER NOT NULL DEFAULT 100,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  maximum_attempts INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX background_jobs_claim_idx ON background_jobs (status, available_at, priority, created_at)
  WHERE status = 'pending';
CREATE INDEX background_jobs_lease_idx ON background_jobs (lease_owner, lease_expires_at)
  WHERE status = 'leased';

CREATE TABLE job_failures (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES background_jobs(id),
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  permanent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX job_failures_job_idx ON job_failures (job_id, created_at DESC);

CREATE TABLE atproto_connections (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  did TEXT NOT NULL,
  handle TEXT NOT NULL,
  pds_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'connected', 'refreshRequired', 'revoked', 'disconnected', 'error')),
  granted_scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  connected_at TIMESTAMPTZ,
  refreshed_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (did),
  UNIQUE (actor_id, did)
);

CREATE INDEX atproto_connections_actor_idx ON atproto_connections (actor_id) WHERE deleted_at IS NULL;

CREATE TABLE atproto_oauth_states (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  client_kind TEXT NOT NULL CHECK (client_kind IN ('web', 'native')),
  return_route TEXT NOT NULL,
  request_scope TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX atproto_oauth_states_expires_idx ON atproto_oauth_states (expires_at) WHERE consumed_at IS NULL;

CREATE TABLE atproto_oauth_sessions (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL UNIQUE REFERENCES atproto_connections(id),
  encrypted_session BYTEA NOT NULL,
  encryption_key_version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE atproto_publication_preferences (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL UNIQUE REFERENCES actors(id),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  default_mode TEXT NOT NULL DEFAULT 'modulaOnly'
    CHECK (default_mode IN ('modulaOnly', 'askEveryTime', 'crossPostPublic')),
  publish_profile_extension BOOLEAN NOT NULL DEFAULT FALSE,
  publish_module_metadata BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE atproto_publications (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES atproto_connections(id),
  local_record_type TEXT NOT NULL,
  local_record_id TEXT NOT NULL,
  collection TEXT NOT NULL,
  rkey TEXT,
  at_uri TEXT,
  cid TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'pending', 'publishing', 'published', 'updating', 'deleting', 'deleted', 'failed', 'revoked'
  )),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  last_error_code TEXT,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (connection_id, local_record_type, local_record_id, collection)
);

CREATE INDEX atproto_publications_status_idx ON atproto_publications (status, next_retry_at);

CREATE TABLE atproto_records (
  did TEXT NOT NULL,
  collection TEXT NOT NULL,
  rkey TEXT NOT NULL,
  uri TEXT NOT NULL,
  cid TEXT NOT NULL,
  record_json JSONB NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  source_cursor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (did, collection, rkey)
);

CREATE INDEX atproto_records_collection_idx ON atproto_records (collection, indexed_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE atproto_sync_checkpoints (
  source TEXT PRIMARY KEY,
  cursor TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_success_at TIMESTAMPTZ
);

CREATE TABLE atproto_dead_letters (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE operational_controls (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

INSERT INTO operational_controls (key, value) VALUES
  ('atproto.publish.enabled', 'true'::jsonb),
  ('atproto.ingest.enabled', 'true'::jsonb),
  ('atproto.lexicons.disabled', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Search support
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE profiles SET search_vector =
  setweight(to_tsvector('english', coalesce(handle, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(display_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(bio, '')), 'B');

UPDATE posts SET search_vector =
  setweight(to_tsvector('english', coalesce(text, '')), 'A');

CREATE INDEX IF NOT EXISTS profiles_search_vector_idx ON profiles USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS posts_search_vector_idx ON posts USING GIN (search_vector);

CREATE OR REPLACE FUNCTION modula_profiles_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.handle, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.display_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.bio, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION modula_posts_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := setweight(to_tsvector('english', coalesce(NEW.text, '')), 'A');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_search_vector_trg ON profiles;
CREATE TRIGGER profiles_search_vector_trg
  BEFORE INSERT OR UPDATE OF handle, display_name, bio ON profiles
  FOR EACH ROW EXECUTE FUNCTION modula_profiles_search_vector_update();

DROP TRIGGER IF EXISTS posts_search_vector_trg ON posts;
CREATE TRIGGER posts_search_vector_trg
  BEFORE INSERT OR UPDATE OF text ON posts
  FOR EACH ROW EXECUTE FUNCTION modula_posts_search_vector_update();

UPDATE schema_metadata SET value = '002', updated_at = NOW() WHERE key = 'schema_version';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'modula_api') THEN
    GRANT SELECT, INSERT, UPDATE ON sessions, session_capabilities TO modula_api;
    GRANT SELECT, INSERT, UPDATE ON notifications, notification_preferences TO modula_api;
    GRANT SELECT, INSERT, UPDATE ON blocks, mutes, reports TO modula_api;
    GRANT SELECT, INSERT ON moderation_actions TO modula_api;
    GRANT SELECT, INSERT, UPDATE ON background_jobs, job_failures TO modula_api;
    GRANT SELECT, INSERT, UPDATE ON atproto_connections, atproto_oauth_states TO modula_api;
    GRANT SELECT, INSERT, UPDATE ON atproto_oauth_sessions TO modula_api;
    GRANT SELECT, INSERT, UPDATE ON atproto_publication_preferences, atproto_publications TO modula_api;
    GRANT SELECT, INSERT, UPDATE ON atproto_records, atproto_sync_checkpoints, atproto_dead_letters TO modula_api;
    GRANT SELECT, INSERT, UPDATE ON operational_controls TO modula_api;
    GRANT SELECT, INSERT, UPDATE ON posts, post_likes, post_saves, post_reposts, follows, profiles, actors, idempotency_keys TO modula_api;
    GRANT SELECT, INSERT ON post_media TO modula_api;
    GRANT SELECT ON post_saves TO modula_api;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'modula_worker') THEN
    GRANT USAGE ON SCHEMA public TO modula_worker;
    GRANT SELECT, INSERT, UPDATE ON background_jobs, job_failures, outbox_events TO modula_worker;
    GRANT SELECT, INSERT, UPDATE ON notifications, notification_preferences TO modula_worker;
    GRANT SELECT, INSERT, UPDATE ON atproto_connections, atproto_oauth_sessions, atproto_publications TO modula_worker;
    GRANT SELECT, INSERT, UPDATE ON atproto_records, atproto_sync_checkpoints, atproto_dead_letters TO modula_worker;
    GRANT SELECT ON atproto_publication_preferences, operational_controls, posts, profiles, actors TO modula_worker;
    GRANT SELECT, INSERT ON audit_events TO modula_worker;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'modula_backup') THEN
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO modula_backup;
  END IF;
END $$;
