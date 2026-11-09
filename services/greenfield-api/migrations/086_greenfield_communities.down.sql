-- GREENFIELD-FEATURE-REALITY-01 PR-04: remove the Communities domain.
DELETE FROM greenfield_event_schema_registry
WHERE event_version = '1.0.0'
  AND event_type IN (
    'community.created',
    'community.updated',
    'community.member-joined',
    'community.member-left',
    'community.post-created',
    'community.poll-created',
    'community.poll-voted',
    'community.event-created',
    'community.event-responded'
  );

DROP TABLE IF EXISTS greenfield_community_poll_votes;
DROP TABLE IF EXISTS greenfield_community_poll_options;
DROP TABLE IF EXISTS greenfield_community_polls;
DROP TABLE IF EXISTS greenfield_community_event_responses;
DROP TABLE IF EXISTS greenfield_community_events;

DROP INDEX IF EXISTS posts_community_feed_idx;
ALTER TABLE posts
  DROP CONSTRAINT IF EXISTS posts_community_metadata_check,
  DROP COLUMN IF EXISTS community_featured_at,
  DROP COLUMN IF EXISTS community_moderation_state,
  DROP COLUMN IF EXISTS community_id;

DROP TABLE IF EXISTS greenfield_community_memberships;
DROP TABLE IF EXISTS greenfield_community_settings;
DROP TABLE IF EXISTS greenfield_communities;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '085')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
