-- POST-04: generic attachment platform and ordered rich post content.

CREATE TABLE attachments (
  attachment_id TEXT PRIMARY KEY,
  owner_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image','video','audio','pdf','document','unknown')),
  mime_type TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  checksum TEXT,
  storage_key TEXT,
  storage_provider TEXT NOT NULL DEFAULT 'filesystem',
  status TEXT NOT NULL CHECK (status IN ('created','uploading','uploaded','processing','ready','failed','expired','rejected')),
  width INTEGER,
  height INTEGER,
  duration_seconds DOUBLE PRECISION,
  page_count INTEGER,
  thumbnail_key TEXT,
  preview_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  attached_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE attachment_upload_sessions (
  upload_id TEXT PRIMARY KEY,
  attachment_id TEXT NOT NULL UNIQUE REFERENCES attachments(attachment_id) ON DELETE CASCADE,
  owner_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  expected_byte_size BIGINT NOT NULL CHECK (expected_byte_size > 0),
  expected_mime_type TEXT NOT NULL,
  expected_checksum TEXT,
  state TEXT NOT NULL CHECK (state IN ('created','uploading','completed','failed','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE post_content (
  content_id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('image','video','audio','pdf','document')),
  attachment_id TEXT NOT NULL REFERENCES attachments(attachment_id),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, sort_order),
  UNIQUE(post_id, attachment_id)
);

CREATE INDEX attachments_owner_status_idx ON attachments(owner_account_id, status, created_at DESC);
CREATE INDEX attachments_orphan_cleanup_idx ON attachments(created_at) WHERE attached_at IS NULL AND status IN ('ready','failed','expired','rejected');
CREATE INDEX attachment_upload_sessions_expiry_idx ON attachment_upload_sessions(expires_at) WHERE state IN ('created','uploading');
CREATE INDEX post_content_post_order_idx ON post_content(post_id, sort_order);
CREATE INDEX post_content_attachment_idx ON post_content(attachment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON attachments, attachment_upload_sessions, post_content TO modula_api;
GRANT SELECT, UPDATE, DELETE ON attachments, attachment_upload_sessions TO modula_worker;
GRANT SELECT ON post_content TO modula_worker;
GRANT SELECT ON attachments, attachment_upload_sessions, post_content TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '057')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
