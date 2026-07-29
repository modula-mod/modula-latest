-- Phase 7E-C: central policy/audit/notification foundations.

CREATE TABLE IF NOT EXISTS greenfield_policy_decision_audit (
  decision_id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES actors(id) ON DELETE SET NULL,
  account_id TEXT REFERENCES greenfield_accounts(account_id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  capability TEXT,
  resource_type TEXT,
  resource_id TEXT,
  resource_owner_actor_id TEXT,
  module_id TEXT,
  connection_id TEXT,
  allowed BOOLEAN NOT NULL,
  code TEXT NOT NULL,
  obligations JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(obligations) = 'array'),
  audit_required BOOLEAN NOT NULL DEFAULT FALSE,
  risk_classification TEXT,
  request_id TEXT,
  correlation_id TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(context) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS greenfield_policy_decision_audit_actor_idx
  ON greenfield_policy_decision_audit(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS greenfield_policy_decision_audit_denied_idx
  ON greenfield_policy_decision_audit(action, code, created_at DESC)
  WHERE allowed = FALSE;

ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS audit_id TEXT,
  ADD COLUMN IF NOT EXISTS account_id TEXT REFERENCES greenfield_accounts(account_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT 'succeeded' CHECK (result IN ('succeeded','denied','failed','cancelled')),
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS ip_classification TEXT NOT NULL DEFAULT 'unknown' CHECK (ip_classification IN ('unknown','local','private','public','trusted-proxy')),
  ADD COLUMN IF NOT EXISTS user_agent_classification TEXT NOT NULL DEFAULT 'unknown' CHECK (user_agent_classification IN ('unknown','browser','mobile','service','bot','cli')),
  ADD COLUMN IF NOT EXISTS metadata_schema_version INTEGER NOT NULL DEFAULT 1;

UPDATE audit_events SET audit_id = id WHERE audit_id IS NULL;
UPDATE audit_events SET action = event_type WHERE action IS NULL;
ALTER TABLE audit_events ALTER COLUMN audit_id SET DEFAULT ('audit-' || md5(random()::text || clock_timestamp()::text));
ALTER TABLE audit_events ALTER COLUMN action SET DEFAULT 'unspecified';
ALTER TABLE audit_events ALTER COLUMN audit_id SET NOT NULL;
ALTER TABLE audit_events ALTER COLUMN action SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS audit_events_audit_id_uidx ON audit_events(audit_id);
CREATE INDEX IF NOT EXISTS audit_events_account_created_idx ON audit_events(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_request_idx ON audit_events(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_events_action_result_idx ON audit_events(action, result, created_at DESC);

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'social' CHECK (category IN ('social','module','AI','connector','automation','security','system','DIMON','marketplace')),
  ADD COLUMN IF NOT EXISTS channels JSONB NOT NULL DEFAULT '["in-app"]'::jsonb CHECK (jsonb_typeof(channels) = 'array'),
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS aggregate_count INTEGER NOT NULL DEFAULT 1 CHECK (aggregate_count > 0),
  ADD COLUMN IF NOT EXISTS aggregate_window_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_aggregated_at TIMESTAMPTZ;

UPDATE notifications
SET aggregate_window_started_at = COALESCE(aggregate_window_started_at, created_at),
    last_aggregated_at = COALESCE(last_aggregated_at, updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_recipient_dedupe_uidx
  ON notifications(recipient_actor_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_category_created_idx
  ON notifications(recipient_actor_id, category, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS web_push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS frequency TEXT NOT NULL DEFAULT 'immediate' CHECK (frequency IN ('immediate','hourly','daily','weekly','manual')),
  ADD COLUMN IF NOT EXISTS digest_mode BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quiet_hours JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(quiet_hours) = 'object'),
  ADD COLUMN IF NOT EXISTS channel_preferences JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(channel_preferences) = 'object'),
  ADD COLUMN IF NOT EXISTS category_preferences JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(category_preferences) = 'object'),
  ADD COLUMN IF NOT EXISTS module_preferences JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(module_preferences) = 'object'),
  ADD COLUMN IF NOT EXISTS connector_failure_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ai_completion_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS automation_failure_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS dimon_transaction_confirmation_enabled BOOLEAN NOT NULL DEFAULT TRUE;

GRANT SELECT, INSERT, UPDATE ON greenfield_policy_decision_audit TO modula_api;
GRANT SELECT, INSERT, UPDATE ON audit_events TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE ON notifications, notification_preferences TO modula_api, modula_worker;

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','020')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
