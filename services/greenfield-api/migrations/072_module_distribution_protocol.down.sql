-- Recovery rollback for MODULE-DISTRIBUTION-03. Immutable blob bytes are not
-- deleted. Refuse to narrow their constraints if new media would be stranded.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM greenfield_release_asset_blobs
    WHERE media_type IN ('application/json','application/schema+json','application/vnd.modula.frontend+json')
       OR byte_size > 26214400
  ) THEN
    RAISE EXCEPTION 'cannot roll back 072 while distribution-only blobs exist; preserve or migrate the immutable blobs first';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS greenfield_release_artifacts_immutable ON greenfield_release_artifacts;
DROP FUNCTION IF EXISTS greenfield_reject_release_artifact_mutation();
DROP TABLE IF EXISTS greenfield_release_artifacts;

DROP TRIGGER IF EXISTS greenfield_module_versions_published_manifest_immutable ON greenfield_module_versions;
DROP FUNCTION IF EXISTS greenfield_reject_published_release_manifest_mutation();
DROP TRIGGER IF EXISTS greenfield_module_releases_published_facts_immutable ON greenfield_module_releases;
DROP FUNCTION IF EXISTS greenfield_reject_published_release_fact_mutation();

ALTER TABLE greenfield_release_asset_blobs
  DROP CONSTRAINT IF EXISTS greenfield_release_asset_blobs_media_type_check,
  DROP CONSTRAINT IF EXISTS greenfield_release_asset_blobs_byte_size_check;
ALTER TABLE greenfield_release_asset_blobs
  ADD CONSTRAINT greenfield_release_asset_blobs_media_type_check CHECK (media_type IN (
    'image/svg+xml','image/png','image/webp','image/jpeg','video/mp4','video/webm',
    'application/gzip','application/x-gzip','application/octet-stream'
  )),
  ADD CONSTRAINT greenfield_release_asset_blobs_byte_size_check
    CHECK (byte_size > 0 AND byte_size <= 26214400);

ALTER TABLE greenfield_extension_installations
  DROP CONSTRAINT IF EXISTS greenfield_extension_installations_lock_check,
  DROP CONSTRAINT IF EXISTS greenfield_extension_installations_release_channel_check,
  DROP CONSTRAINT IF EXISTS greenfield_extension_installations_update_policy_check,
  DROP COLUMN IF EXISTS locked_version,
  DROP COLUMN IF EXISTS release_channel,
  DROP COLUMN IF EXISTS update_policy;

ALTER TABLE greenfield_module_releases
  DROP CONSTRAINT IF EXISTS greenfield_module_releases_channel_check,
  DROP COLUMN IF EXISTS release_channel;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '071')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
