UPDATE greenfield_engine_event_consumer_registrations SET active=FALSE
WHERE engine_id='engine.entitlements' AND event_type='entitlement.changed.v1';
UPDATE greenfield_engine_capability_registrations SET availability='CONTRACT_ONLY'
WHERE engine_id='engine.entitlements';
UPDATE greenfield_engine_registrations SET
  version='1.0.0', execution_mode='CONTRACT_ONLY', runtime_status='CONTRACT_ONLY',
  source_revision='a5511d3065326e5b29f0ab786a6975921b9db286',
  health='{"livePath":null,"readyPath":null,"dependencyIds":[]}'::jsonb,
  updated_at=NOW()
WHERE engine_id='engine.entitlements';
DROP TABLE IF EXISTS greenfield_quota_counters;
DROP TABLE IF EXISTS greenfield_quota_policies;
DROP TABLE IF EXISTS greenfield_usage_events;
DROP TABLE IF EXISTS greenfield_entitlement_events;
DROP TABLE IF EXISTS greenfield_entitlement_capabilities;
DROP TABLE IF EXISTS greenfield_entitlements;
DROP TABLE IF EXISTS greenfield_external_billing_receipts;
DROP TABLE IF EXISTS greenfield_billing_adapter_registrations;
DROP TABLE IF EXISTS greenfield_offers;
UPDATE schema_metadata SET value='048', updated_at=NOW() WHERE key='schema_version';
