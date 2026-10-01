DROP INDEX IF EXISTS greenfield_release_presentation_assets_release_id_idx;
ALTER TABLE greenfield_release_presentation_assets
  DROP COLUMN IF EXISTS sort_order,
  DROP COLUMN IF EXISTS presentation_slot,
  DROP COLUMN IF EXISTS alt_text;
DROP TRIGGER IF EXISTS greenfield_release_asset_blobs_immutable ON greenfield_release_asset_blobs;
DROP FUNCTION IF EXISTS greenfield_reject_release_asset_blob_update();
DROP TABLE IF EXISTS greenfield_release_asset_blobs;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '058')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
