-- Comment media and link-preview cache. Additive only.
-- Up to four items per comment: uploaded attachments (image/video through the
-- existing attachment pipeline) or a GIF picked through the Greenfield GIF proxy.
ALTER TABLE greenfield_comments
  ADD COLUMN IF NOT EXISTS media JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE greenfield_comments DROP CONSTRAINT IF EXISTS greenfield_comments_media_check;
ALTER TABLE greenfield_comments ADD CONSTRAINT greenfield_comments_media_check
  CHECK (jsonb_typeof(media) = 'array' AND jsonb_array_length(media) <= 4);
CREATE INDEX IF NOT EXISTS greenfield_comments_media_idx
  ON greenfield_comments USING GIN (media jsonb_path_ops);

-- Server-side cache for the link-preview (unfurl) endpoint. Keyed by the
-- normalised URL hash; failures are cached briefly so hosts are not hammered.
CREATE TABLE IF NOT EXISTS greenfield_link_previews (
  url_hash TEXT PRIMARY KEY CHECK (length(url_hash) = 64),
  url TEXT NOT NULL CHECK (length(url) <= 2048),
  status TEXT NOT NULL CHECK (status IN ('ok', 'failed')),
  preview JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(preview) = 'object'),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS greenfield_link_previews_fetched_idx ON greenfield_link_previews (fetched_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_link_previews TO modula_api;
GRANT SELECT ON greenfield_link_previews TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '064')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
