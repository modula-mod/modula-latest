-- GREENFIELD-V1-CLOSEOUT-FINAL: production-shaped plan evidence showed that
-- the common active-record list and recipient share list fell back to full
-- table scans at 100k records / 25k shares. Keep these indexes narrow and
-- partial so normal reads obtain ordering without indexing historical rows.

CREATE INDEX greenfield_module_records_active_list_idx
  ON greenfield_module_records (
    account_id,
    module_id,
    collection,
    updated_at DESC,
    record_id
  )
  INCLUDE (revision)
  WHERE deleted_at IS NULL;

CREATE INDEX greenfield_module_record_shares_active_recipient_list_idx
  ON greenfield_module_record_shares (
    recipient_account_id,
    module_id,
    created_at DESC,
    share_id
  )
  INCLUDE (record_type, record_id, permission, expires_at)
  WHERE revoked_at IS NULL;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '074')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
