-- Preserve immutable blobs if any release already uses the new media types.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM greenfield_release_asset_blobs
    WHERE media_type IN (
      'application/vnd.modula.game-web+tgz',
      'application/vnd.modula.web-runtime+tgz',
      'application/vnd.modula.asset-pack+tgz'
    )
  ) THEN
    RAISE EXCEPTION 'cannot roll back 077 while optional package blobs exist';
  END IF;
END;
$$;

ALTER TABLE greenfield_release_asset_blobs
  DROP CONSTRAINT IF EXISTS greenfield_release_asset_blobs_media_type_check;

ALTER TABLE greenfield_release_asset_blobs
  ADD CONSTRAINT greenfield_release_asset_blobs_media_type_check CHECK (media_type IN (
    'image/svg+xml','image/png','image/webp','image/jpeg','video/mp4','video/webm',
    'application/gzip','application/x-gzip','application/octet-stream',
    'application/json','application/schema+json','application/vnd.modula.frontend+json'
  ));

UPDATE schema_metadata SET value = '076', updated_at = NOW() WHERE key = 'schema_version';
