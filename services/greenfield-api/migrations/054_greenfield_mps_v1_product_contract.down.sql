DELETE FROM greenfield_product_identity_aliases
 WHERE alias_id IN ('modula.vault-notes','modula.module.vaultNotes','module-vault-notes');

DROP TABLE IF EXISTS greenfield_product_privacy_declarations;
DROP TABLE IF EXISTS greenfield_release_presentation_assets;
DROP TABLE IF EXISTS greenfield_mps_ingestions;
DROP TABLE IF EXISTS greenfield_product_identity_aliases;
DROP TABLE IF EXISTS greenfield_product_relationships;
DROP TABLE IF EXISTS greenfield_product_family_members;
DROP TABLE IF EXISTS greenfield_product_families;

ALTER TABLE greenfield_developer_products
  DROP CONSTRAINT IF EXISTS greenfield_developer_products_kind_check;
ALTER TABLE greenfield_developer_products
  ADD CONSTRAINT greenfield_developer_products_kind_check
  CHECK (kind IN ('module','addon','plugin','function','tool','widget','connector','backend-service','backend-engine','game-module'));

ALTER TABLE greenfield_extension_runtime_projection
  DROP CONSTRAINT IF EXISTS greenfield_extension_runtime_projection_product_kind_check;
ALTER TABLE greenfield_extension_runtime_projection
  ADD CONSTRAINT greenfield_extension_runtime_projection_product_kind_check
  CHECK (product_kind IN ('module','addon','plugin','function','tool','widget','connector','service'));

ALTER TABLE greenfield_extension_targets
  DROP CONSTRAINT IF EXISTS greenfield_extension_targets_product_kind_check;
ALTER TABLE greenfield_extension_targets
  ADD CONSTRAINT greenfield_extension_targets_product_kind_check
  CHECK (product_kind IN ('module','addon','plugin','function','tool','widget','connector','service'));

ALTER TABLE greenfield_module_releases
  DROP CONSTRAINT IF EXISTS greenfield_module_releases_product_kind_check;
ALTER TABLE greenfield_module_releases
  ADD CONSTRAINT greenfield_module_releases_product_kind_check
  CHECK (product_kind IN ('module','addon','plugin','function','tool','widget','connector','service'));

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '053')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
