-- MPS product-owned frontend runtime projection.
-- Stores verified release metadata plus the validated declarative projection; it is not an executable bundle store.

CREATE TABLE greenfield_release_frontends (
  frontend_id TEXT PRIMARY KEY,
  ingestion_id TEXT NOT NULL UNIQUE REFERENCES greenfield_mps_ingestions(ingestion_id) ON DELETE CASCADE,
  release_id TEXT REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  version TEXT NOT NULL,
  frontend_mode TEXT NOT NULL CHECK (frontend_mode IN ('declarative','host-contribution')),
  artifact_role TEXT NOT NULL DEFAULT 'product.frontend' CHECK (artifact_role = 'product.frontend'),
  artifact_path TEXT NOT NULL CHECK (artifact_path !~ '(^/|(^|/)\.\.(/|$)|\\)'),
  media_type TEXT NOT NULL CHECK (media_type = 'application/vnd.modula.frontend+json'),
  artifact_sha256 TEXT NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$' AND artifact_sha256 !~ '^0+$'),
  schema_version TEXT NOT NULL CHECK (schema_version = '1.0.0'),
  mps_version TEXT NOT NULL CHECK (mps_version IN ('1.0-RC','1.0')),
  entry_view TEXT,
  route_count INTEGER NOT NULL DEFAULT 0 CHECK (route_count BETWEEN 0 AND 96),
  routes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(routes) = 'array'),
  compatibility JSONB NOT NULL CHECK (jsonb_typeof(compatibility) = 'object'),
  required_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(required_capabilities) = 'array'),
  runtime_projection JSONB NOT NULL CHECK (jsonb_typeof(runtime_projection) = 'object'),
  verified_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, version)
);
CREATE INDEX greenfield_release_frontends_release_idx
  ON greenfield_release_frontends(release_id, product_id, version);

CREATE FUNCTION greenfield_reject_release_frontend_update() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.release_id IS NULL
     AND NEW.release_id IS NOT NULL
     AND (to_jsonb(NEW) - 'release_id') = (to_jsonb(OLD) - 'release_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'published frontend projections are immutable; create a new release';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER greenfield_release_frontends_immutable
  BEFORE UPDATE ON greenfield_release_frontends
  FOR EACH ROW EXECUTE FUNCTION greenfield_reject_release_frontend_update();

GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_release_frontends TO modula_api, modula_worker;
GRANT SELECT ON greenfield_release_frontends TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '055')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
