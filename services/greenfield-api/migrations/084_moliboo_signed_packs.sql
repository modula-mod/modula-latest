-- GREENFIELD-FEATURE-REALITY-01 / PR-01
-- Moliboo content packs reuse the immutable release/blob inventory and the
-- publisher signing-key registry. This migration adds only Moliboo catalogue
-- state, direct artifact-signature evidence, and account-owned wardrobe state.

ALTER TABLE greenfield_release_asset_blobs
  DROP CONSTRAINT IF EXISTS greenfield_release_asset_blobs_media_type_check;
ALTER TABLE greenfield_release_asset_blobs
  ADD CONSTRAINT greenfield_release_asset_blobs_media_type_check CHECK (media_type IN (
    'image/svg+xml','image/png','image/webp','image/jpeg','video/mp4','video/webm',
    'application/gzip','application/x-gzip','application/octet-stream',
    'application/json','application/schema+json','application/vnd.modula.frontend+json',
    'application/vnd.modula.web-runtime+tgz','application/vnd.modula.game-web+tgz',
    'application/vnd.modula.asset-pack+tgz',
    'application/vnd.modula.moliboo-asset-pack+json'
  ));

-- The generic release signature authenticates canonical release facts. Native
-- PackageManager additionally verifies an Ed25519 signature over the lowercase
-- artifact digest itself. This immutable evidence references the same artifact
-- inventory and the same publisher key registry; it is not a second trust root.
CREATE TABLE greenfield_release_artifact_signatures (
  artifact_signature_id TEXT PRIMARY KEY CHECK (char_length(artifact_signature_id) BETWEEN 3 AND 400),
  artifact_id TEXT NOT NULL REFERENCES greenfield_release_artifacts(artifact_id) ON DELETE RESTRICT,
  signature_key_id TEXT NOT NULL REFERENCES greenfield_publisher_signing_keys(key_id) ON DELETE RESTRICT,
  algorithm TEXT NOT NULL DEFAULT 'Ed25519' CHECK (algorithm = 'Ed25519'),
  signed_digest TEXT NOT NULL CHECK (signed_digest ~ '^[0-9a-f]{64}$'),
  signature TEXT NOT NULL CHECK (signature ~ '^[A-Za-z0-9+/]{86}==$'),
  verification_state TEXT NOT NULL CHECK (verification_state IN ('verified','invalid','unknownKey','revokedKey')),
  verified_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (artifact_id, signature_key_id)
);
CREATE INDEX greenfield_release_artifact_signatures_key_idx
  ON greenfield_release_artifact_signatures(signature_key_id, artifact_id);

CREATE FUNCTION greenfield_reject_artifact_signature_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'artifact signature evidence is immutable; create a new release';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER greenfield_release_artifact_signatures_immutable
  BEFORE UPDATE OR DELETE ON greenfield_release_artifact_signatures
  FOR EACH ROW EXECUTE FUNCTION greenfield_reject_artifact_signature_mutation();

CREATE TABLE greenfield_moliboo_characters (
  character_id TEXT PRIMARY KEY CHECK (character_id ~ '^moliboo\.[0-9]{1,4}$'),
  character_number INTEGER NOT NULL UNIQUE CHECK (character_number BETWEEN 1 AND 9999),
  character_key TEXT NOT NULL UNIQUE CHECK (character_key ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 100),
  family_id TEXT NOT NULL CHECK (family_id ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  series INTEGER NOT NULL CHECK (series BETWEEN 1 AND 99),
  wearable BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_moliboo_characters_series_idx
  ON greenfield_moliboo_characters(series, character_number);

CREATE TABLE greenfield_moliboo_pack_releases (
  release_id TEXT PRIMARY KEY REFERENCES greenfield_module_releases(release_id) ON DELETE RESTRICT,
  artifact_id TEXT NOT NULL UNIQUE REFERENCES greenfield_release_artifacts(artifact_id) ON DELETE RESTRICT,
  package_id TEXT NOT NULL CHECK (package_id ~ '^moliboo\.character\.[0-9]{1,4}$'),
  version TEXT NOT NULL CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'),
  character_id TEXT NOT NULL REFERENCES greenfield_moliboo_characters(character_id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL CHECK (family_id ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  minimum_host_version TEXT NOT NULL CHECK (minimum_host_version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'),
  runtime_version INTEGER NOT NULL CHECK (runtime_version BETWEEN 1 AND 100),
  asset_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(asset_capabilities) = 'array'),
  rollback_compatible BOOLEAN NOT NULL DEFAULT TRUE,
  availability TEXT NOT NULL CHECK (availability IN ('approved','withdrawn')),
  state_revision INTEGER NOT NULL DEFAULT 1 CHECK (state_revision > 0),
  approved_at TIMESTAMPTZ NOT NULL,
  withdrawn_at TIMESTAMPTZ,
  withdrawal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (package_id, version),
  CHECK ((availability = 'withdrawn') = (withdrawn_at IS NOT NULL)),
  CHECK (withdrawal_reason IS NULL OR char_length(withdrawal_reason) BETWEEN 1 AND 500)
);
CREATE INDEX greenfield_moliboo_pack_releases_catalogue_idx
  ON greenfield_moliboo_pack_releases(availability, package_id, version DESC);
CREATE INDEX greenfield_moliboo_pack_releases_character_idx
  ON greenfield_moliboo_pack_releases(character_id, availability, approved_at DESC);

CREATE TABLE greenfield_moliboo_pack_release_events (
  event_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES greenfield_moliboo_pack_releases(release_id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('approved','withdrawn','restored')),
  state_revision INTEGER NOT NULL CHECK (state_revision > 0),
  actor_account_id TEXT REFERENCES greenfield_accounts(account_id),
  reason TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (release_id, state_revision)
);
CREATE INDEX greenfield_moliboo_pack_release_events_release_idx
  ON greenfield_moliboo_pack_release_events(release_id, state_revision);

CREATE FUNCTION greenfield_reject_moliboo_pack_event_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Moliboo release events are append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER greenfield_moliboo_pack_release_events_append_only
  BEFORE UPDATE OR DELETE ON greenfield_moliboo_pack_release_events
  FOR EACH ROW EXECUTE FUNCTION greenfield_reject_moliboo_pack_event_mutation();

-- Migration 083 introduced the canonical Moliboo catalogue, inventory and
-- equipped-state tables. Extend that domain for installable character packs;
-- do not create a parallel ownership or wardrobe implementation.
ALTER TABLE greenfield_moliboo_items
  DROP CONSTRAINT greenfield_moliboo_items_item_id_check,
  DROP CONSTRAINT greenfield_moliboo_items_slot_check,
  ADD COLUMN item_type TEXT NOT NULL DEFAULT 'cosmetic',
  ADD COLUMN character_id TEXT REFERENCES greenfield_moliboo_characters(character_id) ON DELETE RESTRICT,
  ADD COLUMN wearable BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN revoked_at TIMESTAMPTZ,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD CONSTRAINT greenfield_moliboo_items_item_id_check
    CHECK (item_id ~ '^moliboo\.item\.[a-z0-9_]+$' OR item_id ~ '^moliboo\.[0-9]{1,4}$'),
  ADD CONSTRAINT greenfield_moliboo_items_slot_check
    CHECK (slot IN ('character','headwear','hair','face','top','outerwear','bottom','footwear','back','handheld','aura')),
  ADD CONSTRAINT greenfield_moliboo_items_item_type_check
    CHECK (item_type IN ('character','cosmetic')),
  ADD CONSTRAINT greenfield_moliboo_items_character_relation_check
    CHECK ((item_type = 'character') = (character_id IS NOT NULL)),
  ADD CONSTRAINT greenfield_moliboo_items_character_slot_check
    CHECK (item_type <> 'character' OR slot = 'character');
CREATE UNIQUE INDEX greenfield_moliboo_items_character_idx
  ON greenfield_moliboo_items(character_id) WHERE character_id IS NOT NULL;

ALTER TABLE greenfield_moliboo_inventory
  DROP CONSTRAINT greenfield_moliboo_inventory_source_check,
  ADD COLUMN grant_id TEXT,
  ADD CONSTRAINT greenfield_moliboo_inventory_source_check CHECK (source IN (
    'quest','achievement','collection','premium_entitlement','admin_grant','gift',
    'qa_fixture','purchase','promotion','migration','system'
  )),
  ADD CONSTRAINT greenfield_moliboo_inventory_grant_id_key UNIQUE (grant_id);
CREATE INDEX greenfield_moliboo_inventory_account_acquired_idx
  ON greenfield_moliboo_inventory(account_id, acquired_at DESC, item_id);

ALTER TABLE greenfield_moliboo_equipped
  DROP CONSTRAINT greenfield_moliboo_equipped_character_id_check,
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT greenfield_moliboo_equipped_character_id_check CHECK (
    character_id ~ '^moliboo\.[a-z0-9_]+\.[a-z0-9_]+$'
    OR character_id ~ '^moliboo\.[0-9]{1,4}$'
  );
CREATE UNIQUE INDEX greenfield_moliboo_equipped_active_account_idx
  ON greenfield_moliboo_equipped(account_id) WHERE is_active;

-- Sticker artwork is projected from the same immutable release/blob inventory.
-- The signed manifest artifact enumerates every image digest, so image bytes
-- cannot be substituted independently of the publisher-approved pack release.
CREATE TABLE greenfield_sticker_pack_releases (
  release_id TEXT PRIMARY KEY REFERENCES greenfield_module_releases(release_id) ON DELETE RESTRICT,
  manifest_artifact_id TEXT NOT NULL UNIQUE REFERENCES greenfield_release_artifacts(artifact_id) ON DELETE RESTRICT,
  pack_id TEXT NOT NULL CHECK (pack_id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  version TEXT NOT NULL CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  icon TEXT NOT NULL CHECK (char_length(icon) BETWEEN 1 AND 16),
  series INTEGER CHECK (series BETWEEN 1 AND 99),
  availability TEXT NOT NULL CHECK (availability IN ('approved','withdrawn')),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 10000),
  approved_at TIMESTAMPTZ NOT NULL,
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pack_id, version),
  CHECK ((availability = 'withdrawn') = (withdrawn_at IS NOT NULL))
);
CREATE INDEX greenfield_sticker_pack_releases_catalogue_idx
  ON greenfield_sticker_pack_releases(availability, sort_order, pack_id, version DESC);

CREATE TABLE greenfield_stickers (
  release_id TEXT NOT NULL REFERENCES greenfield_sticker_pack_releases(release_id) ON DELETE RESTRICT,
  sticker_id TEXT NOT NULL CHECK (sticker_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,99}$'),
  label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
  emoji TEXT NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  artifact_id TEXT NOT NULL UNIQUE REFERENCES greenfield_release_artifacts(artifact_id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL CHECK (sort_order BETWEEN 0 AND 10000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (release_id, sticker_id),
  UNIQUE (release_id, sort_order)
);
CREATE INDEX greenfield_stickers_identity_idx ON greenfield_stickers(sticker_id, release_id);

GRANT SELECT ON greenfield_release_artifact_signatures,
  greenfield_moliboo_characters, greenfield_moliboo_pack_releases,
  greenfield_moliboo_pack_release_events, greenfield_moliboo_items,
  greenfield_moliboo_inventory, greenfield_moliboo_equipped,
  greenfield_sticker_pack_releases,
  greenfield_stickers TO modula_worker, modula_backup;
GRANT SELECT, INSERT ON greenfield_release_artifact_signatures TO modula_api;
GRANT SELECT, INSERT, UPDATE ON greenfield_moliboo_characters,
  greenfield_moliboo_pack_releases,
  greenfield_moliboo_inventory, greenfield_moliboo_equipped,
  greenfield_sticker_pack_releases,
  greenfield_stickers TO modula_api;
GRANT SELECT, INSERT ON greenfield_moliboo_pack_release_events TO modula_api;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '084')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
