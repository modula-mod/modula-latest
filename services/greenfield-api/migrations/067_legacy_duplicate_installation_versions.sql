-- Historical accounts may have two distinct installation identities for one
-- module. Both must be able to leave an untrusted release for the same trusted
-- target without deleting either installation or its account-owned data.
ALTER TABLE greenfield_extension_installations
  DROP CONSTRAINT greenfield_extension_installa_extension_version_id_account__key;

-- Ordinary installs keep their original unique conflict target. Only an exact
-- historical identity migrated by the trusted-target worker may be exempted.
ALTER TABLE greenfield_extension_installations
  ADD COLUMN legacy_duplicate_allowed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX greenfield_extension_installations_standard_version_account_uidx
  ON greenfield_extension_installations (extension_version_id, account_id)
  WHERE legacy_duplicate_allowed = FALSE;

CREATE INDEX greenfield_extension_installations_account_version_idx
  ON greenfield_extension_installations (account_id, extension_version_id);

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '067')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
