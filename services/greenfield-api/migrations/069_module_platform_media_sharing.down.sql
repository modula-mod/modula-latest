ALTER TABLE greenfield_module_record_changes DROP COLUMN IF EXISTS details;
ALTER TABLE greenfield_module_record_changes DROP COLUMN IF EXISTS change_kind;
ALTER TABLE greenfield_module_record_changes DROP COLUMN IF EXISTS owner_account_id;
ALTER TABLE greenfield_module_record_changes DROP CONSTRAINT IF EXISTS greenfield_module_record_changes_operation_check;
ALTER TABLE greenfield_module_record_changes ADD CONSTRAINT greenfield_module_record_changes_operation_check
  CHECK (operation IN ('create','update','delete','restore','import','purge'));
DROP TABLE IF EXISTS greenfield_module_record_shares;
DROP TABLE IF EXISTS greenfield_module_record_media_bindings;
INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '068')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
