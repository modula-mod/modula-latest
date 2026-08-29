-- Greenfield × MPS 1.0-RC: generic product contract ingestion.
-- Extends existing registry/release tables. Does not create a parallel product runtime.

ALTER TABLE greenfield_module_releases
  DROP CONSTRAINT IF EXISTS greenfield_module_releases_product_kind_check;
ALTER TABLE greenfield_module_releases
  ADD CONSTRAINT greenfield_module_releases_product_kind_check
  CHECK (product_kind IN ('module','addon','plugin','function','tool','widget','connector','service','engine','game','integration','theme'));

ALTER TABLE greenfield_extension_targets
  DROP CONSTRAINT IF EXISTS greenfield_extension_targets_product_kind_check;
ALTER TABLE greenfield_extension_targets
  ADD CONSTRAINT greenfield_extension_targets_product_kind_check
  CHECK (product_kind IN ('module','addon','plugin','function','tool','widget','connector','service','engine','game','integration','theme'));

ALTER TABLE greenfield_extension_runtime_projection
  DROP CONSTRAINT IF EXISTS greenfield_extension_runtime_projection_product_kind_check;
ALTER TABLE greenfield_extension_runtime_projection
  ADD CONSTRAINT greenfield_extension_runtime_projection_product_kind_check
  CHECK (product_kind IN ('module','addon','plugin','function','tool','widget','connector','service','engine','game','integration','theme'));

ALTER TABLE greenfield_developer_products
  DROP CONSTRAINT IF EXISTS greenfield_developer_products_kind_check;
ALTER TABLE greenfield_developer_products
  ADD CONSTRAINT greenfield_developer_products_kind_check
  CHECK (kind IN (
    'module','addon','plugin','function','tool','widget','connector',
    'backend-service','backend-engine','game-module',
    'service','engine','game','integration','theme'
  ));

CREATE TABLE greenfield_product_families (
  family_id TEXT PRIMARY KEY CHECK (family_id ~ '^[a-z][a-z0-9]*(\.[a-z0-9]+(-[a-z0-9]+)*)+$'),
  display_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE greenfield_product_family_members (
  family_id TEXT NOT NULL REFERENCES greenfield_product_families(family_id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  member_role TEXT NOT NULL CHECK (member_role IN ('root','member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (family_id, product_id)
);
CREATE INDEX greenfield_product_family_members_product_idx
  ON greenfield_product_family_members(product_id);

CREATE TABLE greenfield_product_relationships (
  relationship_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'belongsToFamily','extends','targets','requires','optionallyRequires','replaces','supersedes','compatibleWith','providesFor'
  )),
  target_product_id TEXT NOT NULL,
  version_range TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_product_relationships_product_idx
  ON greenfield_product_relationships(product_id, relationship_type);

CREATE TABLE greenfield_product_identity_aliases (
  alias_id TEXT PRIMARY KEY CHECK (char_length(alias_id) BETWEEN 3 AND 128),
  canonical_product_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (alias_id <> canonical_product_id)
);
CREATE INDEX greenfield_product_identity_aliases_canonical_idx
  ON greenfield_product_identity_aliases(canonical_product_id);

CREATE TABLE greenfield_mps_ingestions (
  ingestion_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  version TEXT NOT NULL,
  release_id TEXT REFERENCES greenfield_module_releases(release_id) ON DELETE SET NULL,
  manifest_sha256 TEXT NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  product_standard TEXT NOT NULL,
  manifest_format TEXT NOT NULL,
  registry_kind TEXT NOT NULL,
  frontend_mode TEXT NOT NULL CHECK (frontend_mode IN ('none','declarative','host-contribution')),
  backend_mode TEXT NOT NULL CHECK (backend_mode IN ('none','greenfield-records','service','engine-backed')),
  storage_mode TEXT,
  greenfield_backend_mode TEXT NOT NULL,
  test_fixture BOOLEAN NOT NULL DEFAULT FALSE,
  visibility TEXT NOT NULL,
  manifest JSONB NOT NULL CHECK (jsonb_typeof(manifest) = 'object'),
  projection JSONB NOT NULL CHECK (jsonb_typeof(projection) = 'object'),
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, version)
);
CREATE INDEX greenfield_mps_ingestions_kind_idx ON greenfield_mps_ingestions(registry_kind, test_fixture);

CREATE TABLE greenfield_release_presentation_assets (
  asset_id TEXT PRIMARY KEY,
  ingestion_id TEXT NOT NULL REFERENCES greenfield_mps_ingestions(ingestion_id) ON DELETE CASCADE,
  release_id TEXT REFERENCES greenfield_module_releases(release_id) ON DELETE SET NULL,
  product_id TEXT NOT NULL,
  version TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'product.icon','product.logo','product.wordmark','product.cover','product.hero',
    'product.screenshot','product.video-preview','product.background','product.badge'
  )),
  artifact_path TEXT NOT NULL,
  media_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  sha256 TEXT CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'),
  development_asset BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_release_presentation_assets_release_idx
  ON greenfield_release_presentation_assets(product_id, version, role);

CREATE TABLE greenfield_product_privacy_declarations (
  ingestion_id TEXT PRIMARY KEY REFERENCES greenfield_mps_ingestions(ingestion_id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  version TEXT NOT NULL,
  data_accessed JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_created JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_transmitted JSONB NOT NULL DEFAULT '[]'::jsonb,
  processors JSONB NOT NULL DEFAULT '[]'::jsonb,
  retention TEXT,
  export_policy TEXT,
  deletion_policy TEXT,
  telemetry TEXT,
  declaration JSONB NOT NULL CHECK (jsonb_typeof(declaration) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO greenfield_product_identity_aliases (alias_id, canonical_product_id, reason, created_at)
VALUES
  ('modula.vault-notes', 'digital.modula.vault-notes', 'legacy marketplace identifier', NOW()),
  ('modula.module.vaultNotes', 'digital.modula.vault-notes', 'legacy camelCase identifier', NOW()),
  ('module-vault-notes', 'digital.modula.vault-notes', 'legacy hyphen identifier', NOW())
ON CONFLICT (alias_id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  greenfield_product_families,
  greenfield_product_family_members,
  greenfield_product_relationships,
  greenfield_product_identity_aliases,
  greenfield_mps_ingestions,
  greenfield_release_presentation_assets,
  greenfield_product_privacy_declarations
TO modula_api, modula_worker;
GRANT SELECT ON
  greenfield_product_families,
  greenfield_product_family_members,
  greenfield_product_relationships,
  greenfield_product_identity_aliases,
  greenfield_mps_ingestions,
  greenfield_release_presentation_assets,
  greenfield_product_privacy_declarations
TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '054')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
