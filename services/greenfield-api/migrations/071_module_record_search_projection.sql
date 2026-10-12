-- MODULE-PLATFORM-02B: product-neutral record search delivery.
-- Migrations 069 and 070 are owned by the preceding MP02B integration waves.

ALTER TABLE search_documents DROP CONSTRAINT IF EXISTS search_documents_entity_type_check;
ALTER TABLE search_documents
  ADD CONSTRAINT search_documents_entity_type_check
  CHECK (entity_type IN ('post','profile','module','module-release','note','vault-folder','module-record'));

ALTER TABLE search_projection_state DROP CONSTRAINT IF EXISTS search_projection_state_entity_type_check;
ALTER TABLE search_projection_state
  ADD CONSTRAINT search_projection_state_entity_type_check
  CHECK (entity_type IN ('post','profile','module','module-release','note','vault-folder','module-record'));

ALTER TABLE search_projection_failures DROP CONSTRAINT IF EXISTS search_projection_failures_entity_type_check;
ALTER TABLE search_projection_failures
  ADD CONSTRAINT search_projection_failures_entity_type_check
  CHECK (entity_type IN ('post','profile','module','module-release','note','vault-folder','module-record'));

ALTER TABLE search_reindex_requests DROP CONSTRAINT IF EXISTS search_reindex_requests_entity_type_check;
ALTER TABLE search_reindex_requests
  ADD CONSTRAINT search_reindex_requests_entity_type_check
  CHECK (entity_type IS NULL OR entity_type IN ('post','profile','module','module-release','note','vault-folder','module-record'));

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
) VALUES (
  'module.record.changed',
  '1.0.0',
  'modules',
  'moduleRecord',
  '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false,"required":["moduleId","recordType","recordId","revision","operation","deleted"],"properties":{"moduleId":{"type":"string"},"recordType":{"type":"string"},"recordId":{"type":"string"},"revision":{"type":"integer","minimum":1},"sourceVersion":{"type":"integer","minimum":1},"operation":{"enum":["create","update","delete","restore","purge"]},"deleted":{"type":"boolean"}}}'::jsonb,
  'backward-compatible-additive',
  'standard-module-record-retention',
  'private',
  '["greenfield.audit","greenfield.search.private"]'::jsonb,
  'guarded-idempotent',
  'active',
  NOW(),
  NOW()
)
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
) VALUES (
  'subscription:search.module-record-projector:module.record.changed',
  'module.record.changed',
  'search.module-record-projector',
  'search-index',
  'module-record',
  '{}'::jsonb,
  TRUE,
  ARRAY['account','internal','restricted']::TEXT[],
  ARRAY['private','sensitive','internal']::TEXT[],
  30000,
  4,
  NOW(),
  NOW()
)
ON CONFLICT (event_type, subscriber_id) DO UPDATE SET
  target_type = EXCLUDED.target_type,
  target_key = EXCLUDED.target_key,
  filters = EXCLUDED.filters,
  permitted_visibility = EXCLUDED.permitted_visibility,
  permitted_classifications = EXCLUDED.permitted_classifications,
  subscriber_timeout_ms = EXCLUDED.subscriber_timeout_ms,
  max_concurrency = EXCLUDED.max_concurrency,
  enabled = TRUE,
  updated_at = NOW();

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '071')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
