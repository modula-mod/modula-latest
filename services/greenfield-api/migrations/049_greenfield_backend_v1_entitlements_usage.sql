-- Greenfield Backend V1: generic offers, append-only entitlement history, usage and quotas.

CREATE TABLE greenfield_offers (
  offer_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('FREE','ONE_TIME','SUBSCRIPTION','FREEMIUM','TRIAL','BUNDLE','ENTERPRISE','PRIVATE')),
  display_name TEXT NOT NULL,
  capabilities JSONB NOT NULL CHECK (jsonb_typeof(capabilities)='array'),
  commercial_terms JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(commercial_terms)='object'),
  trial_duration_seconds INTEGER CHECK (trial_duration_seconds IS NULL OR trial_duration_seconds BETWEEN 60 AND 7776000),
  state TEXT NOT NULL CHECK (state IN ('DRAFT','ACTIVE','RETIRED')),
  created_by_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_offers_product_idx ON greenfield_offers(product_id, state, kind);

CREATE TABLE greenfield_billing_adapter_registrations (
  adapter TEXT PRIMARY KEY CHECK (adapter IN ('APPLE','GOOGLE','WEB','ENTERPRISE_ADMIN')),
  state TEXT NOT NULL CHECK (state IN ('NOT_CONFIGURED','ACTIVE','DEGRADED','DISABLED')),
  service_id TEXT,
  configuration_ref TEXT,
  last_verified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (configuration_ref IS NULL OR configuration_ref LIKE 'secret://%')
);
INSERT INTO greenfield_billing_adapter_registrations(adapter,state) VALUES
  ('APPLE','NOT_CONFIGURED'),('GOOGLE','NOT_CONFIGURED'),('WEB','NOT_CONFIGURED'),('ENTERPRISE_ADMIN','ACTIVE');

CREATE TABLE greenfield_external_billing_receipts (
  receipt_id TEXT PRIMARY KEY,
  adapter TEXT NOT NULL REFERENCES greenfield_billing_adapter_registrations(adapter),
  external_transaction_id TEXT NOT NULL,
  owner_account_id TEXT REFERENCES greenfield_accounts(account_id),
  owner_organisation_id TEXT REFERENCES greenfield_developer_organisations(organisation_id),
  product_id TEXT NOT NULL,
  offer_id TEXT NOT NULL REFERENCES greenfield_offers(offer_id),
  state TEXT NOT NULL CHECK (state IN ('OBSERVED','VERIFIED','REJECTED','REVOKED')),
  evidence_hash TEXT NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  verified_by_service_id TEXT,
  observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((owner_account_id IS NOT NULL)::integer + (owner_organisation_id IS NOT NULL)::integer = 1),
  UNIQUE(adapter, external_transaction_id)
);

CREATE TABLE greenfield_entitlements (
  entitlement_id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('ACCOUNT','ORGANISATION')),
  owner_account_id TEXT REFERENCES greenfield_accounts(account_id),
  owner_organisation_id TEXT REFERENCES greenfield_developer_organisations(organisation_id),
  product_id TEXT NOT NULL,
  offer_id TEXT NOT NULL REFERENCES greenfield_offers(offer_id),
  source TEXT NOT NULL CHECK (source IN ('FREE','TRIAL','APPLE','GOOGLE','WEB','ENTERPRISE','ADMIN')),
  state TEXT NOT NULL CHECK (state IN ('TRIAL','ACTIVE','GRACE','PAST_DUE','CANCELLED','EXPIRED','REVOKED')),
  external_receipt_id TEXT REFERENCES greenfield_external_billing_receipts(receipt_id),
  provenance_reference TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((owner_type='ACCOUNT' AND owner_account_id IS NOT NULL AND owner_organisation_id IS NULL) OR (owner_type='ORGANISATION' AND owner_organisation_id IS NOT NULL AND owner_account_id IS NULL)),
  CHECK (expires_at IS NULL OR expires_at > started_at)
);
CREATE INDEX greenfield_entitlements_account_idx ON greenfield_entitlements(owner_account_id, product_id, state);
CREATE INDEX greenfield_entitlements_org_idx ON greenfield_entitlements(owner_organisation_id, product_id, state);

CREATE TABLE greenfield_entitlement_capabilities (
  entitlement_id TEXT NOT NULL REFERENCES greenfield_entitlements(entitlement_id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(entitlement_id, capability)
);

CREATE TABLE greenfield_entitlement_events (
  entitlement_event_id TEXT PRIMARY KEY,
  entitlement_id TEXT NOT NULL REFERENCES greenfield_entitlements(entitlement_id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('GRANTED','STATE_CHANGED','EXPIRED','REVOKED')),
  previous_state TEXT,
  state TEXT NOT NULL CHECK (state IN ('TRIAL','ACTIVE','GRACE','PAST_DUE','CANCELLED','EXPIRED','REVOKED')),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('ACCOUNT','SERVICE','SYSTEM')),
  actor_id TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  provenance_reference TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_entitlement_events_ledger_idx ON greenfield_entitlement_events(entitlement_id, occurred_at);

CREATE TABLE greenfield_usage_events (
  usage_event_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  organisation_id TEXT REFERENCES greenfield_developer_organisations(organisation_id),
  product_id TEXT NOT NULL,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id),
  entitlement_id TEXT REFERENCES greenfield_entitlements(entitlement_id),
  capability TEXT NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN ('ai.request','ai.tokens','storage.bytes','transcription.seconds','media.processing','render.time','function.invocation','job.execution','game.session')),
  quantity BIGINT NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  producer_service_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  trace_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(producer_service_id, idempotency_key)
);
CREATE INDEX greenfield_usage_events_account_idx ON greenfield_usage_events(account_id, metric, occurred_at);
CREATE INDEX greenfield_usage_events_product_idx ON greenfield_usage_events(product_id, metric, occurred_at);

CREATE TABLE greenfield_quota_policies (
  quota_policy_id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('ACCOUNT','ORGANISATION','PRODUCT','ENTITLEMENT','CAPABILITY')),
  scope_id TEXT NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN ('ai.request','ai.tokens','storage.bytes','transcription.seconds','media.processing','render.time','function.invocation','job.execution','game.session')),
  limit_quantity BIGINT NOT NULL CHECK (limit_quantity > 0),
  window_seconds INTEGER NOT NULL CHECK (window_seconds BETWEEN 60 AND 31536000),
  state TEXT NOT NULL CHECK (state IN ('ACTIVE','DISABLED','RETIRED')),
  created_by_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scope_type, scope_id, metric, window_seconds)
);

CREATE TABLE greenfield_quota_counters (
  quota_policy_id TEXT NOT NULL REFERENCES greenfield_quota_policies(quota_policy_id) ON DELETE CASCADE,
  bucket_start TIMESTAMPTZ NOT NULL,
  bucket_end TIMESTAMPTZ NOT NULL,
  consumed_quantity BIGINT NOT NULL CHECK (consumed_quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(quota_policy_id, bucket_start)
);

UPDATE greenfield_engine_registrations SET
  version='1.1.0', execution_mode='IN_PROCESS', runtime_status='READY',
  source_revision='bcef62e4b4e9b6b9a29b7bee52278d7a68a21061',
  health='{"livePath":"/v1/health/live","readyPath":"/v1/health/ready","dependencyIds":["greenfield-postgres"]}'::jsonb,
  updated_at=NOW()
WHERE engine_id='engine.entitlements';
UPDATE greenfield_engine_capability_registrations SET availability='READY'
WHERE engine_id='engine.entitlements';
UPDATE greenfield_engine_event_consumer_registrations SET active=TRUE
WHERE engine_id='engine.entitlements' AND event_type='entitlement.changed.v1';

GRANT SELECT, INSERT, UPDATE ON greenfield_offers, greenfield_billing_adapter_registrations,
  greenfield_entitlements, greenfield_entitlement_capabilities, greenfield_quota_policies, greenfield_quota_counters TO modula_api;
GRANT SELECT, INSERT ON greenfield_external_billing_receipts, greenfield_entitlement_events, greenfield_usage_events TO modula_api, modula_worker;
GRANT SELECT ON greenfield_offers, greenfield_billing_adapter_registrations, greenfield_external_billing_receipts,
  greenfield_entitlements, greenfield_entitlement_capabilities, greenfield_entitlement_events,
  greenfield_usage_events, greenfield_quota_policies, greenfield_quota_counters TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '049')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
