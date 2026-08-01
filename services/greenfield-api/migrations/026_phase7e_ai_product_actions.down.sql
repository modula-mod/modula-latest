DROP TABLE IF EXISTS ai_product_action_applications;
DROP TABLE IF EXISTS ai_product_action_results;
DROP TABLE IF EXISTS ai_product_action_executions;

UPDATE greenfield_module_record_versions
SET change_source = 'update'
WHERE change_source = 'ai-assisted';

ALTER TABLE greenfield_module_record_versions
  DROP CONSTRAINT IF EXISTS greenfield_module_record_versions_change_source_check;

ALTER TABLE greenfield_module_record_versions
  ADD CONSTRAINT greenfield_module_record_versions_change_source_check
  CHECK (change_source IN ('update','restore','import','delete'));

ALTER TABLE greenfield_module_record_versions
  DROP COLUMN IF EXISTS metadata;

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','025')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
