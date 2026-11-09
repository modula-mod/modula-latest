-- GREENFIELD-FEATURE-REALITY-01 PR-04: persistent Communities domain.
-- Numbered 086 to follow Gate 01's 085_publisher_release_console.
-- 084 is #147/#160 moliboo signed packs; 085 is Gate 01 publisher release console.
-- Those branches are not on main yet, so this tree still goes 083 then 086.

CREATE TABLE greenfield_communities (
  community_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  owner_actor_id TEXT NOT NULL REFERENCES actors(id),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 5000),
  category TEXT NOT NULL CHECK (char_length(category) BETWEEN 1 AND 80),
  visibility TEXT NOT NULL CHECK (visibility IN ('public','private')),
  discoverable BOOLEAN NOT NULL DEFAULT TRUE,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  membership_policy TEXT NOT NULL CHECK (membership_policy IN ('open','approval')),
  posting_policy TEXT NOT NULL CHECK (posting_policy IN ('members','moderators')),
  icon_attachment_id TEXT REFERENCES attachments(attachment_id),
  cover_attachment_id TEXT REFERENCES attachments(attachment_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK (visibility = 'public' OR discoverable = FALSE)
);

CREATE UNIQUE INDEX greenfield_communities_slug_unique
  ON greenfield_communities (lower(slug))
  WHERE deleted_at IS NULL;
CREATE INDEX greenfield_communities_discovery_idx
  ON greenfield_communities (featured DESC, updated_at DESC, community_id DESC)
  WHERE deleted_at IS NULL AND discoverable = TRUE;
CREATE INDEX greenfield_communities_category_idx
  ON greenfield_communities (category, updated_at DESC)
  WHERE deleted_at IS NULL AND discoverable = TRUE;

CREATE TABLE greenfield_community_settings (
  community_id TEXT PRIMARY KEY REFERENCES greenfield_communities(community_id) ON DELETE CASCADE,
  allow_attachments BOOLEAN NOT NULL DEFAULT TRUE,
  reactions_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  featured_posts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  invite_links_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_words TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE greenfield_community_memberships (
  community_id TEXT NOT NULL REFERENCES greenfield_communities(community_id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  role TEXT NOT NULL CHECK (role IN ('owner','admin','moderator','member','restricted')),
  status TEXT NOT NULL CHECK (status IN ('active','pending','banned','left')),
  notify_mentions BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_digest BOOLEAN NOT NULL DEFAULT FALSE,
  event_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (community_id, actor_id),
  CHECK ((status = 'active' AND joined_at IS NOT NULL) OR status <> 'active'),
  CHECK (role <> 'owner' OR status = 'active')
);

CREATE UNIQUE INDEX greenfield_community_single_owner_idx
  ON greenfield_community_memberships (community_id)
  WHERE role = 'owner' AND status = 'active';
CREATE INDEX greenfield_community_members_active_idx
  ON greenfield_community_memberships (community_id, joined_at DESC, actor_id DESC)
  WHERE status = 'active';
CREATE INDEX greenfield_community_actor_memberships_idx
  ON greenfield_community_memberships (actor_id, status, updated_at DESC);

ALTER TABLE posts
  ADD COLUMN community_id TEXT REFERENCES greenfield_communities(community_id),
  ADD COLUMN community_moderation_state TEXT CHECK (community_moderation_state IN ('visible','hidden','removed')),
  ADD COLUMN community_featured_at TIMESTAMPTZ,
  ADD CONSTRAINT posts_community_metadata_check CHECK (
    (community_id IS NULL AND community_moderation_state IS NULL AND community_featured_at IS NULL)
    OR (community_id IS NOT NULL AND community_moderation_state IS NOT NULL)
  );

CREATE INDEX posts_community_feed_idx
  ON posts (community_id, community_featured_at DESC NULLS LAST, created_at DESC, id DESC)
  WHERE deleted_at IS NULL AND community_id IS NOT NULL AND community_moderation_state = 'visible';

CREATE TABLE greenfield_community_events (
  event_id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES greenfield_communities(community_id) ON DELETE CASCADE,
  creator_actor_id TEXT NOT NULL REFERENCES actors(id),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 10000),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL CHECK (char_length(timezone) BETWEEN 1 AND 100),
  location_type TEXT NOT NULL CHECK (location_type IN ('online','inPerson','tba')),
  location_name TEXT CHECK (location_name IS NULL OR char_length(location_name) <= 300),
  online_url TEXT CHECK (online_url IS NULL OR char_length(online_url) <= 2000),
  cover_attachment_id TEXT REFERENCES attachments(attachment_id),
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK (ends_at > starts_at),
  CHECK (location_type <> 'online' OR online_url IS NOT NULL)
);

CREATE INDEX greenfield_community_events_schedule_idx
  ON greenfield_community_events (community_id, starts_at ASC, event_id ASC)
  WHERE deleted_at IS NULL;

CREATE TABLE greenfield_community_event_responses (
  event_id TEXT NOT NULL REFERENCES greenfield_community_events(event_id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  response TEXT NOT NULL CHECK (response IN ('going','interested')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, actor_id)
);

CREATE INDEX greenfield_community_event_responses_count_idx
  ON greenfield_community_event_responses (event_id, response);

CREATE TABLE greenfield_community_polls (
  poll_id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES greenfield_communities(community_id) ON DELETE CASCADE,
  creator_actor_id TEXT NOT NULL REFERENCES actors(id),
  question TEXT NOT NULL CHECK (char_length(question) BETWEEN 1 AND 500),
  closes_at TIMESTAMPTZ NOT NULL,
  allow_vote_changes BOOLEAN NOT NULL DEFAULT TRUE,
  results_visibility TEXT NOT NULL DEFAULT 'afterVote' CHECK (results_visibility IN ('always','afterVote','afterClose')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK (closes_at > created_at)
);

CREATE INDEX greenfield_community_polls_list_idx
  ON greenfield_community_polls (community_id, created_at DESC, poll_id DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE greenfield_community_poll_options (
  poll_id TEXT NOT NULL REFERENCES greenfield_community_polls(poll_id) ON DELETE CASCADE,
  option_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 200),
  PRIMARY KEY (poll_id, option_id),
  UNIQUE (poll_id, position)
);

CREATE TABLE greenfield_community_poll_votes (
  poll_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poll_id, actor_id),
  FOREIGN KEY (poll_id, option_id)
    REFERENCES greenfield_community_poll_options(poll_id, option_id)
    ON DELETE CASCADE
);

CREATE INDEX greenfield_community_poll_votes_count_idx
  ON greenfield_community_poll_votes (poll_id, option_id);

WITH registry(event_type, aggregate_type, classification, replay_policy) AS (
  VALUES
    ('community.created','community','internal','guarded-idempotent'),
    ('community.updated','community','internal','guarded-idempotent'),
    ('community.member-joined','communityMembership','private','safe-idempotent'),
    ('community.member-left','communityMembership','private','safe-idempotent'),
    ('community.post-created','communityPost','internal','guarded-idempotent'),
    ('community.poll-created','communityPoll','internal','guarded-idempotent'),
    ('community.poll-voted','communityPollVote','private','safe-idempotent'),
    ('community.event-created','communityEvent','internal','guarded-idempotent'),
    ('community.event-responded','communityEventResponse','private','safe-idempotent')
)
INSERT INTO greenfield_event_schema_registry (
  event_type, event_version, owner, aggregate_type, json_schema,
  compatibility_policy, retention_policy, data_classification,
  permitted_subscribers, replay_policy, lifecycle_state, created_at, updated_at
)
SELECT
  event_type,
  '1.0.0',
  'communities',
  aggregate_type,
  jsonb_build_object(
    '$schema', 'https://json-schema.org/draft/2020-12/schema',
    'type', 'object',
    'additionalProperties', true,
    'description', event_type || ' payload'
  ),
  'backward-compatible-additive',
  'standard-social-retention',
  classification,
  CASE WHEN classification = 'private'
    THEN '["greenfield.audit","greenfield.notifications","greenfield.analytics"]'::jsonb
    ELSE '["greenfield.audit","greenfield.search","greenfield.notifications","greenfield.analytics"]'::jsonb
  END,
  replay_policy,
  'active',
  NOW(),
  NOW()
FROM registry
ON CONFLICT (event_type, event_version) DO UPDATE SET
  owner = EXCLUDED.owner,
  aggregate_type = EXCLUDED.aggregate_type,
  json_schema = EXCLUDED.json_schema,
  compatibility_policy = EXCLUDED.compatibility_policy,
  retention_policy = EXCLUDED.retention_policy,
  data_classification = EXCLUDED.data_classification,
  permitted_subscribers = EXCLUDED.permitted_subscribers,
  replay_policy = EXCLUDED.replay_policy,
  lifecycle_state = EXCLUDED.lifecycle_state,
  updated_at = NOW();

GRANT SELECT, INSERT, UPDATE, DELETE ON
  greenfield_communities,
  greenfield_community_settings,
  greenfield_community_memberships,
  greenfield_community_events,
  greenfield_community_event_responses,
  greenfield_community_polls,
  greenfield_community_poll_options,
  greenfield_community_poll_votes
TO modula_api;

GRANT SELECT ON
  greenfield_communities,
  greenfield_community_settings,
  greenfield_community_memberships,
  greenfield_community_events,
  greenfield_community_event_responses,
  greenfield_community_polls,
  greenfield_community_poll_options,
  greenfield_community_poll_votes
TO modula_worker, modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '086')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
