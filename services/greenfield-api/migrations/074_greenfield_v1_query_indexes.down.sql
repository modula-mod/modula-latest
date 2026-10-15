DROP INDEX greenfield_module_record_shares_active_recipient_list_idx;
DROP INDEX greenfield_module_records_active_list_idx;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '073')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
