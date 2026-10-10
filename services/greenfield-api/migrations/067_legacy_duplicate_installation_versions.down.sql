-- Reversal is deliberately refused if migrated identities now share a target.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM greenfield_extension_installations
    GROUP BY extension_version_id, account_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot restore installation version uniqueness while duplicate identities exist';
  END IF;
END $$;

DROP INDEX greenfield_extension_installations_account_version_idx;
ALTER TABLE greenfield_extension_installations
  ADD CONSTRAINT greenfield_extension_installa_extension_version_id_account__key
  UNIQUE (extension_version_id, account_id);

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '066')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
