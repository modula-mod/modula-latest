-- Phase 7E-A: append-only Greenfield domain events and subscriber delivery state.
CREATE TABLE IF NOT EXISTS greenfield_domain_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_version TEXT NOT NULL DEFAULT '1.0.0',
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  account_id TEXT REFERENCES greenfield_accounts(account_id) ON DELETE SET NULL,
  actor_id TEXT REFERENCES actors(id) ON DELETE SET NULL,
  request_id TEXT,
  correlation_id TEXT,
  causation_id TEXT,
  idempotency_key TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS greenfield_domain_events_type_time_idx
  ON greenfield_domain_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS greenfield_domain_events_aggregate_idx
  ON greenfield_domain_events(aggregate_type, aggregate_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS greenfield_domain_events_account_idx
  ON greenfield_domain_events(account_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS greenfield_domain_events_actor_idx
  ON greenfield_domain_events(actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS greenfield_domain_events_request_idx
  ON greenfield_domain_events(request_id)
  WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS greenfield_domain_events_idempotency_idx
  ON greenfield_domain_events(event_type, aggregate_type, aggregate_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS greenfield_event_subscriptions (
  subscription_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  subscriber_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN (
    'notification',
    'search-index',
    'ai-index',
    'analytics',
    'automation',
    'dimon-anchor',
    'connector-sync',
    'background-job',
    'internal-subscriber'
  )),
  target_key TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(filters) = 'object'),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_type, subscriber_id)
);

CREATE INDEX IF NOT EXISTS greenfield_event_subscriptions_event_idx
  ON greenfield_event_subscriptions(event_type, enabled);

CREATE TABLE IF NOT EXISTS greenfield_event_deliveries (
  delivery_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES greenfield_domain_events(event_id) ON DELETE CASCADE,
  subscriber_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN (
    'notification',
    'search-index',
    'ai-index',
    'analytics',
    'automation',
    'dimon-anchor',
    'connector-sync',
    'background-job',
    'internal-subscriber'
  )),
  target_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','leased','delivered','failed','dead_letter','cancelled')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  maximum_attempts INTEGER NOT NULL DEFAULT 5 CHECK (maximum_attempts > 0),
  failure_code TEXT,
  failure_message TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, subscriber_id)
);

CREATE INDEX IF NOT EXISTS greenfield_event_deliveries_claim_idx
  ON greenfield_event_deliveries(status, available_at, created_at);
CREATE INDEX IF NOT EXISTS greenfield_event_deliveries_event_idx
  ON greenfield_event_deliveries(event_id);
CREATE INDEX IF NOT EXISTS greenfield_event_deliveries_subscriber_idx
  ON greenfield_event_deliveries(subscriber_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_domain_events TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_event_subscriptions TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_event_deliveries TO modula_api, modula_worker;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','018') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
