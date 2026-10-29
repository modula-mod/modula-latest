-- GREENFIELD-GUBIC-FOUNDATION-01: game-specific catalogue policy layered on
-- the existing immutable registry. Release, artifact, signature, dependency,
-- compatibility and installation truth remain in the registry tables.

CREATE TABLE greenfield_game_catalogue_entries (
  game_id TEXT PRIMARY KEY CHECK (game_id ~ '^[a-z0-9]+([.-][a-z0-9]+)+$'),
  publisher_id TEXT NOT NULL REFERENCES greenfield_publishers(publisher_id),
  origin_type TEXT NOT NULL CHECK (origin_type IN (
    'modula-developed','external-open-source','independent-publisher','commercial-publisher'
  )),
  genre TEXT NOT NULL CHECK (char_length(genre) BETWEEN 1 AND 80),
  categories JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(categories) = 'array'),
  runtime_category TEXT NOT NULL CHECK (runtime_category IN (
    'html5-javascript','phaser','playcanvas','browser-runtime','streamed'
  )),
  age_classification JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(age_classification) = 'object'),
  availability TEXT NOT NULL DEFAULT 'unavailable' CHECK (availability IN (
    'available','coming-soon','unavailable','region-restricted'
  )),
  publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (publication_status IN (
    'draft','in-review','published','rejected','retired'
  )),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  featured_rank INTEGER CHECK (featured_rank IS NULL OR featured_rank BETWEEN 1 AND 1000),
  created_by_account_id TEXT REFERENCES greenfield_accounts(account_id),
  updated_by_account_id TEXT REFERENCES greenfield_accounts(account_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NOT featured OR (publication_status = 'published' AND availability = 'available')),
  CHECK ((featured AND featured_rank IS NOT NULL) OR (NOT featured AND featured_rank IS NULL))
);

CREATE INDEX greenfield_game_catalogue_public_idx
  ON greenfield_game_catalogue_entries(publication_status, availability, featured, featured_rank, game_id);
CREATE INDEX greenfield_game_catalogue_publisher_idx
  ON greenfield_game_catalogue_entries(publisher_id, publication_status, game_id);

-- Append-only catalogue governance evidence. It records proposals and review
-- decisions without mutating registry release history.
CREATE TABLE greenfield_game_catalogue_events (
  event_id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES greenfield_game_catalogue_entries(game_id) ON DELETE RESTRICT,
  publisher_id TEXT NOT NULL REFERENCES greenfield_publishers(publisher_id),
  event_type TEXT NOT NULL CHECK (event_type IN ('registered','metadata-updated','submitted','published','rejected','retired','featured','unfeatured')),
  actor_account_id TEXT REFERENCES greenfield_accounts(account_id),
  previous_status TEXT,
  publication_status TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_game_catalogue_events_game_idx
  ON greenfield_game_catalogue_events(game_id, occurred_at, event_id);

CREATE FUNCTION greenfield_reject_game_catalogue_event_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'game catalogue events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER greenfield_game_catalogue_events_immutable
  BEFORE UPDATE OR DELETE ON greenfield_game_catalogue_events
  FOR EACH ROW EXECUTE FUNCTION greenfield_reject_game_catalogue_event_mutation();

GRANT SELECT, INSERT, UPDATE ON greenfield_game_catalogue_entries TO modula_api, modula_worker;
GRANT SELECT, INSERT ON greenfield_game_catalogue_events TO modula_api, modula_worker;
GRANT SELECT ON greenfield_game_catalogue_entries, greenfield_game_catalogue_events TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '078')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
