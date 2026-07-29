-- Phase 7E Block 4: unified search projections, diagnostics and reindex control.

CREATE TABLE IF NOT EXISTS search_documents (
  document_id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL CHECK (schema_version = '1.0.0'),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('post','profile','module','module-release')),
  entity_id TEXT NOT NULL,
  source_version BIGINT NOT NULL CHECK (source_version >= 0),
  account_id TEXT,
  owner_id TEXT,
  title TEXT,
  body TEXT,
  summary TEXT,
  keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  visibility TEXT NOT NULL CHECK (visibility IN ('public','followers','private','account','system')),
  status TEXT NOT NULL CHECK (status IN ('active','deleted','hidden','quarantined','unavailable')),
  language TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL,
  search_vector TSVECTOR NOT NULL DEFAULT ''::tsvector,
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS search_documents_vector_idx ON search_documents USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS search_documents_entity_type_idx ON search_documents(entity_type);
CREATE INDEX IF NOT EXISTS search_documents_account_id_idx ON search_documents(account_id);
CREATE INDEX IF NOT EXISTS search_documents_owner_id_idx ON search_documents(owner_id);
CREATE INDEX IF NOT EXISTS search_documents_visibility_idx ON search_documents(visibility);
CREATE INDEX IF NOT EXISTS search_documents_status_idx ON search_documents(status);
CREATE INDEX IF NOT EXISTS search_documents_updated_at_idx ON search_documents(updated_at DESC, document_id DESC);
CREATE INDEX IF NOT EXISTS search_documents_tags_idx ON search_documents USING GIN(tags);
CREATE UNIQUE INDEX IF NOT EXISTS search_documents_entity_identity_idx ON search_documents(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS search_projection_state (
  projector_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('post','profile','module','module-release')),
  last_event_id TEXT REFERENCES greenfield_domain_events(event_id) ON DELETE SET NULL,
  last_processed_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_failure_code TEXT,
  processed_count INTEGER NOT NULL DEFAULT 0 CHECK (processed_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  lag_seconds INTEGER NOT NULL DEFAULT 0 CHECK (lag_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS search_projection_state_entity_idx ON search_projection_state(entity_type);
CREATE INDEX IF NOT EXISTS search_projection_state_lag_idx ON search_projection_state(lag_seconds DESC);

CREATE TABLE IF NOT EXISTS search_projection_failures (
  failure_id TEXT PRIMARY KEY,
  projector_id TEXT NOT NULL,
  event_id TEXT NOT NULL REFERENCES greenfield_domain_events(event_id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('post','profile','module','module-release')),
  entity_id TEXT NOT NULL,
  failure_code TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  first_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  sanitised_details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(sanitised_details) = 'object'),
  UNIQUE(projector_id, event_id)
);

CREATE INDEX IF NOT EXISTS search_projection_failures_unresolved_idx
  ON search_projection_failures(projector_id, last_failed_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS search_projection_failures_entity_idx
  ON search_projection_failures(entity_type, entity_id, resolved_at);

CREATE TABLE IF NOT EXISTS saved_searches (
  saved_search_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  query TEXT NOT NULL CHECK (length(trim(query)) BETWEEN 1 AND 500),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(filters) = 'object'),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS saved_searches_account_idx ON saved_searches(account_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_account_name_unique
  ON saved_searches(account_id, lower(name));

CREATE TABLE IF NOT EXISTS recent_searches (
  recent_search_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  query TEXT NOT NULL CHECK (length(trim(query)) BETWEEN 1 AND 500),
  normalized_query TEXT NOT NULL CHECK (length(trim(normalized_query)) BETWEEN 1 AND 500),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(filters) = 'object'),
  searched_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS recent_searches_account_idx ON recent_searches(account_id, searched_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS recent_searches_account_query_unique
  ON recent_searches(account_id, normalized_query);

CREATE TABLE IF NOT EXISTS search_query_metrics (
  request_id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES greenfield_accounts(account_id) ON DELETE SET NULL,
  actor_id TEXT REFERENCES actors(id) ON DELETE SET NULL,
  entity_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  took_ms INTEGER NOT NULL CHECK (took_ms >= 0),
  result_count INTEGER NOT NULL CHECK (result_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS search_query_metrics_created_idx ON search_query_metrics(created_at DESC);

CREATE TABLE IF NOT EXISTS search_reindex_requests (
  reindex_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('single-entity','entity-type','account-scope','full-index')),
  entity_type TEXT CHECK (entity_type IS NULL OR entity_type IN ('post','profile','module','module-release')),
  entity_id TEXT,
  account_id TEXT REFERENCES greenfield_accounts(account_id) ON DELETE SET NULL,
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 500),
  requested_by_actor_id TEXT REFERENCES actors(id) ON DELETE SET NULL,
  request_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('queued','running','completed','cancelled','failed')),
  processed_count INTEGER NOT NULL DEFAULT 0 CHECK (processed_count >= 0),
  failure_code TEXT,
  cancellation_requested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS search_reindex_requests_state_idx ON search_reindex_requests(state, created_at DESC);
CREATE INDEX IF NOT EXISTS search_reindex_requests_account_idx ON search_reindex_requests(account_id, created_at DESC);

WITH registry(event_type, owner, aggregate_type, classification, replay_policy, retention_policy) AS (
  VALUES
    ('module.release.imported','modules','moduleRelease','internal','guarded-idempotent','standard-platform-retention'),
    ('module.release.published','modules','moduleRelease','internal','guarded-idempotent','standard-platform-retention'),
    ('module.release.quarantined','modules','moduleRelease','sensitive','manual-approval-required','standard-platform-retention'),
    ('module.release.revoked','modules','moduleRelease','sensitive','manual-approval-required','standard-platform-retention'),
    ('search.document-indexed','search','searchDocument','internal','not-replayable','search-ops-retention'),
    ('search.document-deleted','search','searchDocument','internal','not-replayable','search-ops-retention'),
    ('search.projection-failed','search','searchProjectionFailure','internal','not-replayable','search-ops-retention'),
    ('search.reindex-requested','search','searchReindex','internal','manual-approval-required','search-ops-retention'),
    ('search.reindex-completed','search','searchReindex','internal','not-replayable','search-ops-retention'),
    ('search.reindex-failed','search','searchReindex','internal','not-replayable','search-ops-retention')
)
INSERT INTO greenfield_event_schema_registry (
  event_type,
  event_version,
  owner,
  aggregate_type,
  json_schema,
  compatibility_policy,
  retention_policy,
  data_classification,
  permitted_subscribers,
  replay_policy,
  lifecycle_state,
  created_at,
  updated_at
)
SELECT
  event_type,
  '1.0.0',
  owner,
  aggregate_type,
  jsonb_build_object(
    '$schema', 'https://json-schema.org/draft/2020-12/schema',
    'type', 'object',
    'additionalProperties', true,
    'description', event_type || ' payload'
  ),
  'backward-compatible-additive',
  retention_policy,
  classification,
  CASE
    WHEN event_type LIKE 'search.%' THEN '["greenfield.audit","greenfield.diagnostics"]'::jsonb
    WHEN classification = 'sensitive' THEN '["greenfield.audit","greenfield.policy","greenfield.search","greenfield.notifications"]'::jsonb
    ELSE '["greenfield.audit","greenfield.search","greenfield.notifications","greenfield.automation","greenfield.analytics"]'::jsonb
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

WITH subscriptions(event_type, subscriber_id, target_key, visibility, classifications) AS (
  VALUES
    ('post.created','search.post-projector','post',ARRAY['public','account','actor','internal']::TEXT[],ARRAY['public','internal','private']::TEXT[]),
    ('post.updated','search.post-projector','post',ARRAY['public','account','actor','internal']::TEXT[],ARRAY['public','internal','private']::TEXT[]),
    ('post.deleted','search.post-projector','post',ARRAY['public','account','actor','internal']::TEXT[],ARRAY['public','internal','private']::TEXT[]),
    ('post.visibility-changed','search.post-projector','post',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('profile.updated','search.profile-projector','profile',ARRAY['public','account','actor','internal']::TEXT[],ARRAY['public','internal','private']::TEXT[]),
    ('profile.visibility-changed','search.profile-projector','profile',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('account.deactivated','search.profile-projector','profile',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('account.deletion-requested','search.profile-projector','profile',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('module.discovered','search.module-projector','module',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('module.installed','search.module-projector','module',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('module.updated','search.module-projector','module',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('module.quarantined','search.module-projector','module',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('module.uninstalled','search.module-projector','module',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('module.health-changed','search.module-projector','module',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('module.release.imported','search.module-projector','module',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('module.release.published','search.module-projector','module',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('module.release.quarantined','search.module-projector','module',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('module.release.revoked','search.module-projector','module',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('module.update-available','search.module-release-projector','module-release',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('module.release.imported','search.module-release-projector','module-release',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('module.release.published','search.module-release-projector','module-release',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('module.release.quarantined','search.module-release-projector','module-release',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[]),
    ('module.release.revoked','search.module-release-projector','module-release',ARRAY['public','account','actor','internal','restricted']::TEXT[],ARRAY['public','internal','private','sensitive']::TEXT[])
)
INSERT INTO greenfield_event_subscriptions (
  subscription_id,
  event_type,
  subscriber_id,
  target_type,
  target_key,
  filters,
  enabled,
  permitted_visibility,
  permitted_classifications,
  subscriber_timeout_ms,
  max_concurrency,
  created_at,
  updated_at
)
SELECT
  'subscription:' || subscriber_id || ':' || event_type,
  event_type,
  subscriber_id,
  'search-index',
  target_key,
  '{}'::jsonb,
  TRUE,
  visibility,
  classifications,
  30000,
  4,
  NOW(),
  NOW()
FROM subscriptions
ON CONFLICT (event_type, subscriber_id) DO UPDATE SET
  target_type = EXCLUDED.target_type,
  target_key = EXCLUDED.target_key,
  filters = EXCLUDED.filters,
  enabled = TRUE,
  permitted_visibility = EXCLUDED.permitted_visibility,
  permitted_classifications = EXCLUDED.permitted_classifications,
  subscriber_timeout_ms = EXCLUDED.subscriber_timeout_ms,
  max_concurrency = EXCLUDED.max_concurrency,
  updated_at = NOW();

GRANT SELECT, INSERT, UPDATE, DELETE ON search_documents TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON search_projection_state TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON search_projection_failures TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_searches TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON recent_searches TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON search_query_metrics TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON search_reindex_requests TO modula_api, modula_worker;

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','021') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
