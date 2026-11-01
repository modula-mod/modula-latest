-- GUBIC-PLAY-01: player library, play sessions, multiplayer lobbies,
-- achievements and developer submissions layered on the GUBIC catalogue (078).
-- Registry tables stay authoritative for releases, artifacts and installs.
-- Rewards (DIMON, Moliboo cosmetics) are NOT granted here; any reward claim
-- must go through server-validated reward services later.

CREATE TABLE greenfield_gubic_library_items (
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  game_id TEXT NOT NULL REFERENCES greenfield_game_catalogue_entries(game_id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  favourite BOOLEAN NOT NULL DEFAULT FALSE,
  last_played_at TIMESTAMPTZ,
  play_count INTEGER NOT NULL DEFAULT 0 CHECK (play_count >= 0),
  total_play_seconds BIGINT NOT NULL DEFAULT 0 CHECK (total_play_seconds >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, game_id)
);
CREATE INDEX greenfield_gubic_library_recent_idx
  ON greenfield_gubic_library_items(account_id, hidden, last_played_at DESC NULLS LAST, game_id);

CREATE TABLE greenfield_gubic_play_sessions (
  session_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  game_id TEXT NOT NULL REFERENCES greenfield_game_catalogue_entries(game_id),
  release_version TEXT CHECK (release_version IS NULL OR char_length(release_version) BETWEEN 1 AND 64),
  lobby_id TEXT,
  client_platform TEXT NOT NULL CHECK (client_platform IN ('ios', 'ipados', 'macos', 'web', 'android')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 0 AND 86400),
  CHECK ((status = 'active') = (ended_at IS NULL))
);
CREATE INDEX greenfield_gubic_play_sessions_account_idx
  ON greenfield_gubic_play_sessions(account_id, status, started_at DESC);
CREATE UNIQUE INDEX greenfield_gubic_one_active_session_per_game_idx
  ON greenfield_gubic_play_sessions(account_id, game_id) WHERE status = 'active';

CREATE TABLE greenfield_gubic_lobbies (
  lobby_id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES greenfield_game_catalogue_entries(game_id),
  host_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'invite')),
  join_code TEXT NOT NULL UNIQUE CHECK (join_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  max_players INTEGER NOT NULL CHECK (max_players BETWEEN 2 AND 16),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-game', 'closed')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (expires_at > created_at)
);
CREATE INDEX greenfield_gubic_lobbies_public_idx
  ON greenfield_gubic_lobbies(game_id, visibility, status, created_at DESC);

CREATE TABLE greenfield_gubic_lobby_members (
  lobby_id TEXT NOT NULL REFERENCES greenfield_gubic_lobbies(lobby_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  role TEXT NOT NULL CHECK (role IN ('host', 'player')),
  ready BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  PRIMARY KEY (lobby_id, account_id)
);
CREATE INDEX greenfield_gubic_lobby_members_account_idx
  ON greenfield_gubic_lobby_members(account_id, left_at);

-- Achievement definitions are declared by the publisher (manifest) and
-- become visible once the game is published.
CREATE TABLE greenfield_gubic_achievements (
  game_id TEXT NOT NULL REFERENCES greenfield_game_catalogue_entries(game_id),
  achievement_key TEXT NOT NULL CHECK (achievement_key ~ '^[a-z0-9][a-z0-9_.-]{0,63}$'),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 280),
  points INTEGER NOT NULL DEFAULT 10 CHECK (points BETWEEN 0 AND 100),
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  retired BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, achievement_key)
);

-- Append-only: an unlock is identity history and survives uninstall/downgrade.
CREATE TABLE greenfield_gubic_achievement_unlocks (
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  game_id TEXT NOT NULL,
  achievement_key TEXT NOT NULL,
  session_id TEXT REFERENCES greenfield_gubic_play_sessions(session_id),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, game_id, achievement_key),
  FOREIGN KEY (game_id, achievement_key) REFERENCES greenfield_gubic_achievements(game_id, achievement_key)
);
CREATE INDEX greenfield_gubic_unlocks_account_idx
  ON greenfield_gubic_achievement_unlocks(account_id, unlocked_at DESC);

CREATE FUNCTION greenfield_reject_gubic_unlock_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'GUBIC achievement unlocks are append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER greenfield_gubic_unlocks_immutable
  BEFORE UPDATE OR DELETE ON greenfield_gubic_achievement_unlocks
  FOR EACH ROW EXECUTE FUNCTION greenfield_reject_gubic_unlock_mutation();

CREATE TABLE greenfield_gubic_submissions (
  submission_id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL CHECK (game_id ~ '^[a-z0-9]+([.-][a-z0-9]+)+$'),
  publisher_id TEXT NOT NULL REFERENCES greenfield_publishers(publisher_id),
  submitted_by_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  version TEXT NOT NULL CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$'),
  manifest JSONB NOT NULL CHECK (jsonb_typeof(manifest) = 'object'),
  manifest_sha256 TEXT NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  monetisation TEXT NOT NULL DEFAULT 'free' CHECK (monetisation IN ('free', 'paid', 'in-game-purchases')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'in-review', 'approved', 'rejected', 'withdrawn')),
  reviewer_account_id TEXT REFERENCES greenfield_accounts(account_id),
  decision_reason TEXT CHECK (decision_reason IS NULL OR char_length(decision_reason) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  UNIQUE (game_id, version)
);
CREATE INDEX greenfield_gubic_submissions_publisher_idx
  ON greenfield_gubic_submissions(publisher_id, status, created_at DESC);
CREATE INDEX greenfield_gubic_submissions_queue_idx
  ON greenfield_gubic_submissions(status, created_at);

-- Premium capabilities for GUBIC (per the Modula Premium plan): playing,
-- library, lobbies, achievements and free publishing stay free (Core).
-- Paid tiers only add new creator/team capabilities. All paid capabilities
-- are qa_only until payments are authorised.
INSERT INTO greenfield_premium_capabilities (catalogue_version, capability_id, display_name, minimum_rank, availability_mode, value_by_tier, metadata)
SELECT 1, capability_id, display_name, minimum_rank, availability_mode, value_by_tier::jsonb, metadata::jsonb
FROM (VALUES
  ('gubic_play', 'GUBIC play, library, lobbies and achievements', 0, 'existing_free', '{}', '{"product":"gubic"}'),
  ('gubic_publish_free', 'GUBIC free game publishing', 0, 'existing_free', '{}', '{"product":"gubic"}'),
  ('gubic_lobby_size', 'GUBIC lobby size', 0, 'existing_free', '{"core":8,"plus":12,"horizon":16,"horizon_plus":16,"studio":16}', '{"product":"gubic","enforcement":"server"}'),
  ('gubic_creator_monetisation', 'GUBIC paid games and creator storefront', 30, 'qa_only', '{}', '{"product":"gubic","payments":"not_authorised"}'),
  ('gubic_creator_analytics', 'GUBIC creator analytics', 20, 'qa_only', '{}', '{"product":"gubic"}'),
  ('gubic_studio_team_publishing', 'GUBIC studio team publishing', 40, 'qa_only', '{}', '{"product":"gubic"}')
) AS capability(capability_id, display_name, minimum_rank, availability_mode, value_by_tier, metadata)
WHERE EXISTS (SELECT 1 FROM greenfield_premium_catalogue_versions WHERE catalogue_version = 1)
ON CONFLICT (catalogue_version, capability_id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON greenfield_gubic_library_items, greenfield_gubic_play_sessions,
  greenfield_gubic_lobbies, greenfield_gubic_lobby_members, greenfield_gubic_achievements,
  greenfield_gubic_submissions TO modula_api;
GRANT SELECT, INSERT ON greenfield_gubic_achievement_unlocks TO modula_api;
GRANT SELECT ON greenfield_gubic_library_items, greenfield_gubic_play_sessions, greenfield_gubic_lobbies,
  greenfield_gubic_lobby_members, greenfield_gubic_achievements, greenfield_gubic_achievement_unlocks,
  greenfield_gubic_submissions TO modula_worker, modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '080')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
