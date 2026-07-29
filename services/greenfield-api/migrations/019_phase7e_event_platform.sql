-- Phase 7E-B: canonical event envelope, schema registry, idempotent inbox and replay state.

ALTER TABLE greenfield_domain_events
  ADD COLUMN IF NOT EXISTS aggregate_version INTEGER,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('public','account','actor','internal','restricted')),
  ADD COLUMN IF NOT EXISTS classification TEXT NOT NULL DEFAULT 'internal' CHECK (classification IN ('public','internal','private','sensitive','restricted'));

UPDATE greenfield_domain_events
SET
  request_id = COALESCE(request_id, event_id),
  correlation_id = COALESCE(correlation_id, request_id, event_id)
WHERE request_id IS NULL OR correlation_id IS NULL;

ALTER TABLE greenfield_domain_events
  ALTER COLUMN request_id SET NOT NULL,
  ALTER COLUMN correlation_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS greenfield_domain_events_classification_idx
  ON greenfield_domain_events(classification, visibility, occurred_at DESC);

CREATE TABLE IF NOT EXISTS greenfield_event_schema_registry (
  event_type TEXT NOT NULL,
  event_version TEXT NOT NULL,
  owner TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  json_schema JSONB NOT NULL CHECK (jsonb_typeof(json_schema) = 'object'),
  compatibility_policy TEXT NOT NULL,
  retention_policy TEXT NOT NULL,
  data_classification TEXT NOT NULL CHECK (data_classification IN ('public','internal','private','sensitive','restricted')),
  permitted_subscribers JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(permitted_subscribers) = 'array'),
  replay_policy TEXT NOT NULL CHECK (replay_policy IN ('safe-idempotent','guarded-idempotent','manual-approval-required','not-replayable')),
  lifecycle_state TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle_state IN ('active','deprecated','retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(event_type, event_version)
);

WITH registry(event_type, owner, aggregate_type, classification, replay_policy, retention_policy) AS (
  VALUES
    ('account.created','identity','account','private','guarded-idempotent','standard-platform-retention'),
    ('account.updated','identity','account','private','guarded-idempotent','standard-platform-retention'),
    ('account.deactivated','identity','account','sensitive','manual-approval-required','standard-platform-retention'),
    ('account.deletion-requested','identity','account','sensitive','manual-approval-required','account-deletion-retention'),
    ('profile.updated','identity','profile','internal','guarded-idempotent','standard-platform-retention'),
    ('profile.visibility-changed','identity','profile','private','manual-approval-required','standard-platform-retention'),
    ('session.created','identity','session','sensitive','not-replayable','security-retention'),
    ('session.revoked','identity','session','sensitive','not-replayable','security-retention'),
    ('post.created','social','post','internal','guarded-idempotent','standard-platform-retention'),
    ('post.updated','social','post','internal','guarded-idempotent','standard-platform-retention'),
    ('post.deleted','social','post','internal','manual-approval-required','standard-platform-retention'),
    ('post.visibility-changed','social','post','private','manual-approval-required','standard-platform-retention'),
    ('post.saved','social','postSave','private','guarded-idempotent','standard-platform-retention'),
    ('post.unsaved','social','postSave','private','guarded-idempotent','standard-platform-retention'),
    ('comment.created','social','comment','internal','guarded-idempotent','standard-platform-retention'),
    ('comment.updated','social','comment','internal','guarded-idempotent','standard-platform-retention'),
    ('comment.deleted','social','comment','internal','manual-approval-required','standard-platform-retention'),
    ('reaction.created','social','reaction','internal','safe-idempotent','standard-platform-retention'),
    ('reaction.removed','social','reaction','internal','safe-idempotent','standard-platform-retention'),
    ('follow.created','social','follow','internal','safe-idempotent','standard-platform-retention'),
    ('follow.removed','social','follow','internal','safe-idempotent','standard-platform-retention'),
    ('module.discovered','modules','moduleRelease','internal','guarded-idempotent','standard-platform-retention'),
    ('module.install-requested','modules','moduleInstallation','private','manual-approval-required','standard-platform-retention'),
    ('module.installed','modules','moduleInstallation','internal','guarded-idempotent','standard-platform-retention'),
    ('module.enabled','modules','moduleInstallation','internal','guarded-idempotent','standard-platform-retention'),
    ('module.disabled','modules','moduleInstallation','internal','guarded-idempotent','standard-platform-retention'),
    ('module.update-available','modules','moduleRelease','internal','guarded-idempotent','standard-platform-retention'),
    ('module.update-started','modules','moduleInstallation','internal','guarded-idempotent','standard-platform-retention'),
    ('module.updated','modules','moduleInstallation','internal','guarded-idempotent','standard-platform-retention'),
    ('module.update-failed','modules','moduleInstallation','internal','guarded-idempotent','standard-platform-retention'),
    ('module.quarantined','modules','moduleRelease','sensitive','manual-approval-required','standard-platform-retention'),
    ('module.uninstalled','modules','moduleInstallation','private','manual-approval-required','standard-platform-retention'),
    ('module.health-changed','modules','moduleInstallation','internal','guarded-idempotent','standard-platform-retention'),
    ('note.created','notes','note','private','guarded-idempotent','standard-platform-retention'),
    ('note.updated','notes','note','private','guarded-idempotent','standard-platform-retention'),
    ('note.archived','notes','note','private','guarded-idempotent','standard-platform-retention'),
    ('note.deleted','notes','note','private','manual-approval-required','standard-platform-retention'),
    ('note.restored','notes','note','private','manual-approval-required','standard-platform-retention'),
    ('note.linked','notes','noteLink','private','guarded-idempotent','standard-platform-retention'),
    ('note.exported','notes','noteExport','sensitive','manual-approval-required','standard-platform-retention'),
    ('note.ai-processed','notes','noteAiArtifact','sensitive','manual-approval-required','standard-platform-retention'),
    ('ai.requested','ai','aiRequest','sensitive','manual-approval-required','ai-usage-retention'),
    ('ai.started','ai','aiRequest','sensitive','not-replayable','ai-usage-retention'),
    ('ai.completed','ai','aiRequest','sensitive','guarded-idempotent','ai-usage-retention'),
    ('ai.failed','ai','aiRequest','sensitive','guarded-idempotent','ai-usage-retention'),
    ('ai.cancelled','ai','aiRequest','sensitive','not-replayable','ai-usage-retention'),
    ('ai.tool-requested','ai','aiToolRun','restricted','manual-approval-required','ai-tool-retention'),
    ('ai.tool-confirmed','ai','aiToolRun','restricted','not-replayable','ai-tool-retention'),
    ('ai.tool-completed','ai','aiToolRun','restricted','guarded-idempotent','ai-tool-retention'),
    ('ai.memory-created','ai','aiMemory','sensitive','manual-approval-required','ai-memory-retention'),
    ('ai.memory-deleted','ai','aiMemory','sensitive','not-replayable','ai-memory-retention'),
    ('connection.created','connectors','connection','sensitive','guarded-idempotent','connector-security-retention'),
    ('connection.authorised','connectors','connection','restricted','not-replayable','connector-security-retention'),
    ('connection.degraded','connectors','connection','sensitive','guarded-idempotent','connector-security-retention'),
    ('connection.refreshed','connectors','connection','restricted','not-replayable','connector-security-retention'),
    ('connection.revoked','connectors','connection','restricted','not-replayable','connector-security-retention'),
    ('connection.disconnected','connectors','connection','sensitive','manual-approval-required','connector-security-retention'),
    ('connector.sync-started','connectors','connectorSync','sensitive','not-replayable','connector-sync-retention'),
    ('connector.sync-completed','connectors','connectorSync','sensitive','guarded-idempotent','connector-sync-retention'),
    ('connector.sync-failed','connectors','connectorSync','sensitive','guarded-idempotent','connector-sync-retention'),
    ('connector.webhook-received','connectors','connectorWebhook','restricted','not-replayable','connector-webhook-retention'),
    ('automation.created','automation','automation','private','guarded-idempotent','standard-platform-retention'),
    ('automation.enabled','automation','automation','private','manual-approval-required','standard-platform-retention'),
    ('automation.triggered','automation','automationExecution','private','not-replayable','automation-run-retention'),
    ('automation.execution-started','automation','automationExecution','private','not-replayable','automation-run-retention'),
    ('automation.execution-completed','automation','automationExecution','private','guarded-idempotent','automation-run-retention'),
    ('automation.execution-failed','automation','automationExecution','private','guarded-idempotent','automation-run-retention'),
    ('automation.disabled','automation','automation','private','manual-approval-required','standard-platform-retention'),
    ('dimon.transaction-prepared','dimon','dimonTransaction','restricted','manual-approval-required','dimon-retention'),
    ('dimon.transaction-submitted','dimon','dimonTransaction','restricted','not-replayable','dimon-retention'),
    ('dimon.transaction-rejected','dimon','dimonTransaction','restricted','guarded-idempotent','dimon-retention'),
    ('dimon.transaction-confirmed','dimon','dimonTransaction','restricted','guarded-idempotent','dimon-retention'),
    ('dimon.block-created','dimon','dimonBlock','public','safe-idempotent','dimon-retention'),
    ('dimon.validator-health-changed','dimon','dimonValidator','internal','safe-idempotent','dimon-retention'),
    ('dimon.anchor-created','dimon','dimonAnchor','public','safe-idempotent','dimon-retention')
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
    WHEN classification = 'restricted' THEN '["greenfield.audit","greenfield.policy","greenfield.diagnostics"]'::jsonb
    WHEN classification = 'sensitive' THEN '["greenfield.audit","greenfield.policy","greenfield.notifications"]'::jsonb
    WHEN classification = 'private' THEN '["greenfield.audit","greenfield.search.private","greenfield.notifications","greenfield.automation"]'::jsonb
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

ALTER TABLE greenfield_event_subscriptions
  ADD COLUMN IF NOT EXISTS permitted_visibility TEXT[] NOT NULL DEFAULT ARRAY['public','account','actor','internal']::TEXT[],
  ADD COLUMN IF NOT EXISTS permitted_classifications TEXT[] NOT NULL DEFAULT ARRAY['public','internal']::TEXT[],
  ADD COLUMN IF NOT EXISTS subscriber_timeout_ms INTEGER NOT NULL DEFAULT 30000 CHECK (subscriber_timeout_ms > 0),
  ADD COLUMN IF NOT EXISTS max_concurrency INTEGER NOT NULL DEFAULT 4 CHECK (max_concurrency > 0);

ALTER TABLE greenfield_event_deliveries
  DROP CONSTRAINT IF EXISTS greenfield_event_deliveries_status_check;

UPDATE greenfield_event_deliveries
SET status = CASE status
  WHEN 'delivered' THEN 'completed'
  WHEN 'failed' THEN 'retrying'
  WHEN 'dead_letter' THEN 'dead_lettered'
  ELSE status
END;

ALTER TABLE greenfield_event_deliveries
  ADD CONSTRAINT greenfield_event_deliveries_status_check
  CHECK (status IN ('pending','leased','processing','completed','retrying','dead_lettered','cancelled'));

CREATE INDEX IF NOT EXISTS greenfield_event_deliveries_dead_letter_idx
  ON greenfield_event_deliveries(subscriber_id, updated_at DESC)
  WHERE status = 'dead_lettered';

CREATE TABLE IF NOT EXISTS greenfield_event_inbox (
  subscriber_id TEXT NOT NULL,
  event_id TEXT NOT NULL REFERENCES greenfield_domain_events(event_id) ON DELETE CASCADE,
  processing_state TEXT NOT NULL CHECK (processing_state IN ('received','processing','completed','failed','skipped')),
  first_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  failure_code TEXT,
  PRIMARY KEY(subscriber_id, event_id)
);

CREATE INDEX IF NOT EXISTS greenfield_event_inbox_state_idx
  ON greenfield_event_inbox(subscriber_id, processing_state, last_attempted_at DESC);

CREATE TABLE IF NOT EXISTS greenfield_event_replay_requests (
  replay_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('event','event_type','date_range','aggregate','dead_letters')),
  requested_by_actor_id TEXT REFERENCES actors(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  request_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  selector JSONB NOT NULL CHECK (jsonb_typeof(selector) = 'object'),
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  state TEXT NOT NULL CHECK (state IN ('planned','running','completed','cancelled','failed')),
  planned_count INTEGER NOT NULL DEFAULT 0 CHECK (planned_count >= 0),
  replayed_count INTEGER NOT NULL DEFAULT 0 CHECK (replayed_count >= 0),
  failure_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS greenfield_event_replay_requests_state_idx
  ON greenfield_event_replay_requests(state, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_event_schema_registry TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_event_inbox TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_event_replay_requests TO modula_api, modula_worker;

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','019') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
