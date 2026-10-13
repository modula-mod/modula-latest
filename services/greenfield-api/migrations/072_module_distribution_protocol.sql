-- MODULE-DISTRIBUTION-03: immutable artifact inventory and installation update policy.

ALTER TABLE greenfield_module_releases
  ADD COLUMN release_channel TEXT NOT NULL DEFAULT 'stable';

UPDATE greenfield_module_releases AS release
SET release_channel = CASE
  WHEN ingestion.manifest #>> '{release,channel}' IN ('stable','beta','rc','dev')
    THEN ingestion.manifest #>> '{release,channel}'
  ELSE 'stable'
END
FROM greenfield_mps_ingestions AS ingestion
WHERE ingestion.release_id = release.release_id;

ALTER TABLE greenfield_module_releases
  ADD CONSTRAINT greenfield_module_releases_channel_check
  CHECK (release_channel IN ('stable','beta','rc','dev'));

-- Once a release crosses the publication boundary, its signed identity and
-- compatibility-bearing manifest facts cannot be rewritten. State,
-- revocation, quarantine, and retrospective signature evidence remain
-- separately governed operations.
CREATE FUNCTION greenfield_reject_published_release_fact_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.release_state IN ('published','superseded','revoked') THEN
      RAISE EXCEPTION 'published releases are immutable; revoke them instead of deleting them';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.release_state IN ('published','superseded','revoked') AND (
    NEW.module_id IS DISTINCT FROM OLD.module_id
    OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.publisher_id IS DISTINCT FROM OLD.publisher_id
    OR NEW.extension_version_id IS DISTINCT FROM OLD.extension_version_id
    OR NEW.manifest_sha256 IS DISTINCT FROM OLD.manifest_sha256
    OR NEW.release_sha256 IS DISTINCT FROM OLD.release_sha256
    OR NEW.source_repository IS DISTINCT FROM OLD.source_repository
    OR NEW.source_commit IS DISTINCT FROM OLD.source_commit
    OR NEW.manifest_path IS DISTINCT FROM OLD.manifest_path
    OR NEW.release_channel IS DISTINCT FROM OLD.release_channel
    OR NEW.product_kind IS DISTINCT FROM OLD.product_kind
  ) THEN
    RAISE EXCEPTION 'published release facts are immutable; create a new release';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER greenfield_module_releases_published_facts_immutable
  BEFORE UPDATE OR DELETE ON greenfield_module_releases
  FOR EACH ROW EXECUTE FUNCTION greenfield_reject_published_release_fact_mutation();

CREATE FUNCTION greenfield_reject_published_release_manifest_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.manifest IS DISTINCT FROM OLD.manifest AND EXISTS (
    SELECT 1 FROM greenfield_module_releases AS release
    WHERE release.module_version_id = OLD.module_version_id
      AND release.release_state IN ('published','superseded','revoked')
  ) THEN
    RAISE EXCEPTION 'published release manifest is immutable; create a new release';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER greenfield_module_versions_published_manifest_immutable
  BEFORE UPDATE ON greenfield_module_versions
  FOR EACH ROW EXECUTE FUNCTION greenfield_reject_published_release_manifest_mutation();

ALTER TABLE greenfield_extension_installations
  ADD COLUMN update_policy TEXT NOT NULL DEFAULT 'automaticStable',
  ADD COLUMN release_channel TEXT NOT NULL DEFAULT 'stable',
  ADD COLUMN locked_version TEXT;

ALTER TABLE greenfield_extension_installations
  ADD CONSTRAINT greenfield_extension_installations_update_policy_check
    CHECK (update_policy IN ('automaticStable','followChannel','lockedVersion','manual')),
  ADD CONSTRAINT greenfield_extension_installations_release_channel_check
    CHECK (release_channel IN ('stable','beta','rc','dev')),
  ADD CONSTRAINT greenfield_extension_installations_lock_check
    CHECK ((update_policy = 'lockedVersion' AND locked_version IS NOT NULL) OR (update_policy <> 'lockedVersion'));

-- The ingest layer accepts a 50 MiB package, so the immutable blob store must
-- be able to retain every accepted package. Frontend/schema media types are
-- exact signed bytes, not mutable runtime projections.
ALTER TABLE greenfield_release_asset_blobs
  DROP CONSTRAINT IF EXISTS greenfield_release_asset_blobs_media_type_check,
  DROP CONSTRAINT IF EXISTS greenfield_release_asset_blobs_byte_size_check;

ALTER TABLE greenfield_release_asset_blobs
  ADD CONSTRAINT greenfield_release_asset_blobs_media_type_check CHECK (media_type IN (
    'image/svg+xml','image/png','image/webp','image/jpeg','video/mp4','video/webm',
    'application/gzip','application/x-gzip','application/octet-stream',
    'application/json','application/schema+json','application/vnd.modula.frontend+json'
  )),
  ADD CONSTRAINT greenfield_release_asset_blobs_byte_size_check
    CHECK (byte_size > 0 AND byte_size <= 52428800);

CREATE TABLE greenfield_release_artifacts (
  artifact_id TEXT PRIMARY KEY CHECK (char_length(artifact_id) BETWEEN 3 AND 320),
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN (
    'module-package','frontend','asset','icon','cover','screenshot','schema','other'
  )),
  sha256 TEXT NOT NULL REFERENCES greenfield_release_asset_blobs(sha256) ON DELETE RESTRICT,
  filename TEXT NOT NULL CHECK (
    char_length(filename) BETWEEN 1 AND 240
    AND filename !~ '[/\\]'
    AND filename NOT IN ('.','..')
  ),
  access_class TEXT NOT NULL CHECK (access_class IN ('public','installation')),
  required_for_offline_launch BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (release_id, kind, sha256, filename)
);
CREATE INDEX greenfield_release_artifacts_release_idx
  ON greenfield_release_artifacts(release_id, required_for_offline_launch DESC, kind, artifact_id);
CREATE INDEX greenfield_release_artifacts_digest_idx
  ON greenfield_release_artifacts(sha256, access_class);

CREATE FUNCTION greenfield_reject_release_artifact_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'release artifact inventory is immutable; create a new release';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER greenfield_release_artifacts_immutable
  BEFORE UPDATE OR DELETE ON greenfield_release_artifacts
  FOR EACH ROW EXECUTE FUNCTION greenfield_reject_release_artifact_mutation();

-- Existing verified packages and artwork gain deterministic inventory rows.
INSERT INTO greenfield_release_artifacts (
  artifact_id, release_id, kind, sha256, filename, access_class, required_for_offline_launch
)
SELECT
  'release:' || release.release_id || ':module-package',
  release.release_id,
  'module-package',
  release.release_sha256,
  regexp_replace(release.module_id || '-' || release.version || '.tar.gz', '[^A-Za-z0-9._-]', '-', 'g'),
  'installation',
  TRUE
FROM greenfield_module_releases AS release
JOIN greenfield_release_asset_blobs AS blob ON blob.sha256 = release.release_sha256
WHERE release.release_sha256 IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO greenfield_release_artifacts (
  artifact_id, release_id, kind, sha256, filename, access_class, required_for_offline_launch
)
SELECT
  'presentation:' || asset.asset_id,
  asset.release_id,
  CASE asset.role
    WHEN 'product.icon' THEN 'icon'
    WHEN 'product.cover' THEN 'cover'
    WHEN 'product.hero' THEN 'cover'
    WHEN 'product.screenshot' THEN 'screenshot'
    ELSE 'asset'
  END,
  asset.sha256,
  regexp_replace(asset.asset_id || '-' || regexp_replace(asset.artifact_path, '^.*/', ''), '[^A-Za-z0-9._-]', '-', 'g'),
  'public',
  FALSE
FROM greenfield_release_presentation_assets AS asset
JOIN greenfield_release_asset_blobs AS blob ON blob.sha256 = asset.sha256
WHERE asset.release_id IS NOT NULL AND asset.sha256 IS NOT NULL
ON CONFLICT DO NOTHING;

GRANT SELECT, INSERT ON greenfield_release_artifacts TO modula_api, modula_worker;
GRANT SELECT ON greenfield_release_artifacts TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '072')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
