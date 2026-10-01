-- POST-05: bind first-class profile avatar/cover media to the attachment platform.

CREATE TABLE profile_media (
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('avatar', 'cover')),
  attachment_id TEXT NOT NULL UNIQUE REFERENCES attachments(attachment_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, kind)
);

CREATE INDEX profile_media_attachment_idx ON profile_media(attachment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON profile_media TO modula_api;
GRANT SELECT ON profile_media TO modula_worker, modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '058')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
