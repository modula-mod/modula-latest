-- Immutable optional package artifacts have their own reviewed media types.
-- The existing 50 MiB blob bound remains unchanged.
ALTER TABLE greenfield_release_asset_blobs
  DROP CONSTRAINT IF EXISTS greenfield_release_asset_blobs_media_type_check;

ALTER TABLE greenfield_release_asset_blobs
  ADD CONSTRAINT greenfield_release_asset_blobs_media_type_check CHECK (media_type IN (
    'image/svg+xml','image/png','image/webp','image/jpeg','video/mp4','video/webm',
    'application/gzip','application/x-gzip','application/octet-stream',
    'application/json','application/schema+json','application/vnd.modula.frontend+json',
    'application/vnd.modula.game-web+tgz',
    'application/vnd.modula.web-runtime+tgz',
    'application/vnd.modula.asset-pack+tgz'
  ));

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '077')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
