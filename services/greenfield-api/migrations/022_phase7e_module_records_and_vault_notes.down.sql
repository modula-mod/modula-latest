DELETE FROM greenfield_event_subscriptions
WHERE subscriber_id = 'search.vault-notes-projector';

DELETE FROM greenfield_event_schema_registry
WHERE event_type LIKE 'vault-notes.%';

DELETE FROM search_reindex_requests WHERE entity_type IN ('note','vault-folder');
DELETE FROM search_projection_failures WHERE entity_type IN ('note','vault-folder');
DELETE FROM search_projection_state WHERE entity_type IN ('note','vault-folder');
DELETE FROM search_documents WHERE entity_type IN ('note','vault-folder');

ALTER TABLE search_reindex_requests DROP CONSTRAINT IF EXISTS search_reindex_requests_entity_type_check;
ALTER TABLE search_reindex_requests
  ADD CONSTRAINT search_reindex_requests_entity_type_check
  CHECK (entity_type IS NULL OR entity_type IN ('post','profile','module','module-release'));

ALTER TABLE search_projection_failures DROP CONSTRAINT IF EXISTS search_projection_failures_entity_type_check;
ALTER TABLE search_projection_failures
  ADD CONSTRAINT search_projection_failures_entity_type_check
  CHECK (entity_type IN ('post','profile','module','module-release'));

ALTER TABLE search_projection_state DROP CONSTRAINT IF EXISTS search_projection_state_entity_type_check;
ALTER TABLE search_projection_state
  ADD CONSTRAINT search_projection_state_entity_type_check
  CHECK (entity_type IN ('post','profile','module','module-release'));

ALTER TABLE search_documents DROP CONSTRAINT IF EXISTS search_documents_entity_type_check;
ALTER TABLE search_documents
  ADD CONSTRAINT search_documents_entity_type_check
  CHECK (entity_type IN ('post','profile','module','module-release'));

DROP TABLE IF EXISTS greenfield_module_export_jobs;
DROP TABLE IF EXISTS greenfield_module_record_versions;

DELETE FROM greenfield_module_actions WHERE action_kind IN ('record.restore','record.purge');
ALTER TABLE greenfield_module_actions
  DROP CONSTRAINT IF EXISTS greenfield_module_actions_action_kind_check;
ALTER TABLE greenfield_module_actions
  ADD CONSTRAINT greenfield_module_actions_action_kind_check
  CHECK (action_kind IN ('route.open','record.create','record.update','record.delete','record.query','function.invoke','settings.update','share','dismiss'));

DELETE FROM greenfield_module_record_events WHERE operation = 'purge';
ALTER TABLE greenfield_module_record_events
  DROP CONSTRAINT IF EXISTS greenfield_module_record_events_operation_check;
ALTER TABLE greenfield_module_record_events
  ADD CONSTRAINT greenfield_module_record_events_operation_check
  CHECK (operation IN ('create','update','delete','restore','move'));

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','021') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
