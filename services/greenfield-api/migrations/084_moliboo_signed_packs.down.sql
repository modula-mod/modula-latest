-- Recovery for 084 is backup/restore plus the prior application image. This
-- down migration is deliberately usable only before Moliboo account/release
-- state exists, so a rollback cannot silently discard ownership or releases.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM greenfield_moliboo_items WHERE item_type = 'character')
     OR EXISTS (SELECT 1 FROM greenfield_moliboo_characters)
     OR EXISTS (SELECT 1 FROM greenfield_moliboo_inventory WHERE grant_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM greenfield_moliboo_equipped WHERE is_active)
     OR EXISTS (SELECT 1 FROM greenfield_moliboo_pack_releases)
     OR EXISTS (SELECT 1 FROM greenfield_sticker_pack_releases)
     OR EXISTS (SELECT 1 FROM greenfield_release_artifact_signatures) THEN
    RAISE EXCEPTION 'cannot roll back 084 while signed-pack release, signature, ownership, or active outfit state exists; restore a pre-084 backup instead';
  END IF;
END;
$$;

DROP TABLE IF EXISTS greenfield_stickers;
DROP TABLE IF EXISTS greenfield_sticker_pack_releases;
DROP TRIGGER IF EXISTS greenfield_moliboo_pack_release_events_append_only ON greenfield_moliboo_pack_release_events;
DROP FUNCTION IF EXISTS greenfield_reject_moliboo_pack_event_mutation();
DROP TABLE IF EXISTS greenfield_moliboo_pack_release_events;
DROP TABLE IF EXISTS greenfield_moliboo_pack_releases;

DROP INDEX IF EXISTS greenfield_moliboo_equipped_active_account_idx;
ALTER TABLE greenfield_moliboo_equipped
  DROP CONSTRAINT greenfield_moliboo_equipped_character_id_check,
  DROP COLUMN is_active,
  ADD CONSTRAINT greenfield_moliboo_equipped_character_id_check
    CHECK (character_id ~ '^moliboo\.[a-z0-9_]+\.[a-z0-9_]+$');

DROP INDEX IF EXISTS greenfield_moliboo_inventory_account_acquired_idx;
ALTER TABLE greenfield_moliboo_inventory
  DROP CONSTRAINT greenfield_moliboo_inventory_grant_id_key,
  DROP CONSTRAINT greenfield_moliboo_inventory_source_check,
  DROP COLUMN grant_id,
  ADD CONSTRAINT greenfield_moliboo_inventory_source_check
    CHECK (source IN ('quest','achievement','collection','premium_entitlement','admin_grant','gift'));

DROP INDEX IF EXISTS greenfield_moliboo_items_character_idx;
ALTER TABLE greenfield_moliboo_items
  DROP CONSTRAINT greenfield_moliboo_items_character_slot_check,
  DROP CONSTRAINT greenfield_moliboo_items_character_relation_check,
  DROP CONSTRAINT greenfield_moliboo_items_item_type_check,
  DROP CONSTRAINT greenfield_moliboo_items_slot_check,
  DROP CONSTRAINT greenfield_moliboo_items_item_id_check,
  DROP COLUMN updated_at,
  DROP COLUMN revoked_at,
  DROP COLUMN wearable,
  DROP COLUMN character_id,
  DROP COLUMN item_type,
  ADD CONSTRAINT greenfield_moliboo_items_item_id_check
    CHECK (item_id ~ '^moliboo\.item\.[a-z0-9_]+$'),
  ADD CONSTRAINT greenfield_moliboo_items_slot_check
    CHECK (slot IN ('headwear','hair','face','top','outerwear','bottom','footwear','back','handheld','aura'));

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
    'application/vnd.modula.web-runtime+tgz','application/vnd.modula.game-web+tgz',
    'application/vnd.modula.asset-pack+tgz'
  ));

-- 083 granted modula_api SELECT only on greenfield_moliboo_items. 084 raised
-- that to SELECT, INSERT, UPDATE. Restore the prior privilege state on rollback.
-- Do not revoke INSERT/UPDATE on inventory or equipped: 083 already grants them
-- full DML to modula_api and modula_worker.
REVOKE INSERT, UPDATE ON greenfield_moliboo_items FROM modula_api;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '083')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
