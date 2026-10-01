-- Registry trust pipeline, step 1: immutable, content-addressed release media.
-- Additive only: no existing row is modified or deleted.

CREATE TABLE greenfield_release_asset_blobs (
  sha256 TEXT PRIMARY KEY CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  media_type TEXT NOT NULL CHECK (media_type IN (
    'image/svg+xml','image/png','image/webp','image/jpeg','video/mp4','video/webm',
    'application/gzip','application/x-gzip','application/octet-stream'
  )),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 26214400),
  bytes BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (octet_length(bytes) = byte_size),
  CHECK (encode(sha256(bytes), 'hex') = sha256)
);

CREATE FUNCTION greenfield_reject_release_asset_blob_update() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'release asset blobs are content-addressed and immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER greenfield_release_asset_blobs_immutable
  BEFORE UPDATE ON greenfield_release_asset_blobs
  FOR EACH ROW EXECUTE FUNCTION greenfield_reject_release_asset_blob_update();

ALTER TABLE greenfield_release_presentation_assets
  ADD COLUMN IF NOT EXISTS alt_text TEXT,
  ADD COLUMN IF NOT EXISTS presentation_slot TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS greenfield_release_presentation_assets_release_id_idx
  ON greenfield_release_presentation_assets(release_id);

GRANT SELECT, INSERT ON greenfield_release_asset_blobs TO modula_api, modula_worker;
GRANT SELECT ON greenfield_release_asset_blobs TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '059')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
