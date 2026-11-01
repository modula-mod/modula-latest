-- Recovery for 080 is backup/restore plus the prior application image. This
-- down migration is deliberately usable only before Moliboo account/release
-- state exists, so a rollback cannot silently discard ownership or releases.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM greenfield_moliboo_ownership)
     OR EXISTS (SELECT 1 FROM greenfield_moliboo_outfit_items)
     OR EXISTS (SELECT 1 FROM greenfield_moliboo_pack_releases)
     OR EXISTS (SELECT 1 FROM greenfield_sticker_pack_releases)
     OR EXISTS (SELECT 1 FROM greenfield_release_artifact_signatures) THEN
    RAISE EXCEPTION 'cannot roll back 080 while Moliboo release, signature, ownership, or outfit state exists; restore a pre-080 backup instead';
  END IF;
END;
$$;

DROP TABLE IF EXISTS greenfield_moliboo_outfit_items;
DROP TABLE IF EXISTS greenfield_stickers;
DROP TABLE IF EXISTS greenfield_sticker_pack_releases;
DROP TABLE IF EXISTS greenfield_moliboo_outfits;
DROP TABLE IF EXISTS greenfield_moliboo_ownership;
DROP TABLE IF EXISTS greenfield_moliboo_items;
DROP TRIGGER IF EXISTS greenfield_moliboo_pack_release_events_append_only ON greenfield_moliboo_pack_release_events;
DROP FUNCTION IF EXISTS greenfield_reject_moliboo_pack_event_mutation();
DROP TABLE IF EXISTS greenfield_moliboo_pack_release_events;
DROP TABLE IF EXISTS greenfield_moliboo_pack_releases;
DROP TABLE IF EXISTS greenfield_moliboo_characters;
DROP TRIGGER IF EXISTS greenfield_release_artifact_signatures_immutable ON greenfield_release_artifact_signatures;
DROP FUNCTION IF EXISTS greenfield_reject_artifact_signature_mutation();
DROP TABLE IF EXISTS greenfield_release_artifact_signatures;

ALTER TABLE greenfield_release_asset_blobs
  DROP CONSTRAINT IF EXISTS greenfield_release_asset_blobs_media_type_check;
ALTER TABLE greenfield_release_asset_blobs
  ADD CONSTRAINT greenfield_release_asset_blobs_media_type_check CHECK (media_type IN (
    'image/svg+xml','image/png','image/webp','image/jpeg','video/mp4','video/webm',
    'application/gzip','application/x-gzip','application/octet-stream',
    'application/json','application/schema+json','application/vnd.modula.frontend+json',
    'application/vnd.modula.web-runtime+tgz'
  ));

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '079')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
