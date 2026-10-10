-- Historical accounts may have two distinct installation identities for one
-- module. Both must be able to leave an untrusted release for the same trusted
-- target without deleting either installation or its account-owned data.
ALTER TABLE greenfield_extension_installations
  DROP CONSTRAINT greenfield_extension_installa_extension_version_id_account__key;

CREATE INDEX greenfield_extension_installations_account_version_idx
  ON greenfield_extension_installations (account_id, extension_version_id);

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '067')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
