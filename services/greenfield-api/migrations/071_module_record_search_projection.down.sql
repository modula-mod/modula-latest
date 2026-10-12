DELETE FROM greenfield_event_subscriptions
WHERE event_type = 'module.record.changed'
  AND subscriber_id = 'search.module-record-projector';

DELETE FROM greenfield_event_schema_registry
WHERE event_type = 'module.record.changed'
  AND event_version = '1.0.0';

DELETE FROM search_reindex_requests WHERE entity_type = 'module-record';
DELETE FROM search_projection_failures WHERE entity_type = 'module-record';
DELETE FROM search_projection_state WHERE entity_type = 'module-record';
DELETE FROM search_documents WHERE entity_type = 'module-record';

ALTER TABLE search_reindex_requests DROP CONSTRAINT IF EXISTS search_reindex_requests_entity_type_check;
ALTER TABLE search_reindex_requests
  ADD CONSTRAINT search_reindex_requests_entity_type_check
  CHECK (entity_type IS NULL OR entity_type IN ('post','profile','module','module-release','note','vault-folder'));

ALTER TABLE search_projection_failures DROP CONSTRAINT IF EXISTS search_projection_failures_entity_type_check;
ALTER TABLE search_projection_failures
  ADD CONSTRAINT search_projection_failures_entity_type_check
  CHECK (entity_type IN ('post','profile','module','module-release','note','vault-folder'));

ALTER TABLE search_projection_state DROP CONSTRAINT IF EXISTS search_projection_state_entity_type_check;
ALTER TABLE search_projection_state
  ADD CONSTRAINT search_projection_state_entity_type_check
  CHECK (entity_type IN ('post','profile','module','module-release','note','vault-folder'));

ALTER TABLE search_documents DROP CONSTRAINT IF EXISTS search_documents_entity_type_check;
ALTER TABLE search_documents
  ADD CONSTRAINT search_documents_entity_type_check
  CHECK (entity_type IN ('post','profile','module','module-release','note','vault-folder'));

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '070')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
