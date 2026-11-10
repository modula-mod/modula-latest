-- Messaging v3: groups, mentions, voice-note attachments, messaging privacy,
-- presence, full-history search and idempotent sends.
-- Additive except two widened CHECK constraints (conversation kind and member
-- state) and one relaxed body CHECK for attachment-only messages.

-- ---- groups ----------------------------------------------------------
ALTER TABLE greenfield_conversations DROP CONSTRAINT greenfield_conversations_kind_check;
ALTER TABLE greenfield_conversations
  ADD CONSTRAINT greenfield_conversations_kind_check CHECK (kind IN ('direct', 'inmail', 'group')),
  ADD COLUMN title TEXT CHECK (title IS NULL OR char_length(title) BETWEEN 1 AND 80),
  ADD COLUMN description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  ADD CONSTRAINT greenfield_conversations_group_title_check CHECK (kind <> 'group' OR title IS NOT NULL);

ALTER TABLE greenfield_conversation_members DROP CONSTRAINT greenfield_conversation_members_state_check;
ALTER TABLE greenfield_conversation_members
  ADD CONSTRAINT greenfield_conversation_members_state_check CHECK (state IN ('active', 'pending', 'declined', 'left', 'removed')),
  ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  ADD COLUMN added_by_actor_id TEXT REFERENCES actors(id);
CREATE INDEX greenfield_conversation_members_conv_state_idx ON greenfield_conversation_members(conversation_id, state);

-- ---- messages: kind, idempotency, search -----------------------------
ALTER TABLE greenfield_conversation_messages DROP CONSTRAINT greenfield_conversation_messages_body_check;
ALTER TABLE greenfield_conversation_messages
  ADD COLUMN message_kind TEXT NOT NULL DEFAULT 'text' CHECK (message_kind IN ('text', 'voice', 'media')),
  ADD COLUMN client_message_id TEXT CHECK (client_message_id IS NULL OR char_length(client_message_id) BETWEEN 8 AND 64),
  ADD CONSTRAINT greenfield_conversation_messages_body_check
    CHECK (char_length(body) <= 20000 AND (char_length(body) >= 1 OR message_kind <> 'text'));
CREATE UNIQUE INDEX greenfield_conversation_messages_client_id_idx
  ON greenfield_conversation_messages(conversation_id, sender_actor_id, client_message_id)
  WHERE client_message_id IS NOT NULL;
CREATE INDEX greenfield_conversation_messages_search_idx
  ON greenfield_conversation_messages USING GIN (to_tsvector('simple', body))
  WHERE deleted_at IS NULL;

-- ---- mentions --------------------------------------------------------
CREATE TABLE greenfield_message_mentions (
  message_id TEXT NOT NULL REFERENCES greenfield_conversation_messages(message_id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, actor_id)
);
CREATE INDEX greenfield_message_mentions_actor_idx ON greenfield_message_mentions(actor_id, created_at DESC);

-- ---- message attachments (voice notes; photo/video gated off) --------
CREATE TABLE greenfield_message_attachments (
  message_id TEXT NOT NULL REFERENCES greenfield_conversation_messages(message_id) ON DELETE CASCADE,
  attachment_id TEXT NOT NULL UNIQUE REFERENCES attachments(attachment_id),
  position SMALLINT NOT NULL CHECK (position BETWEEN 0 AND 9),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms BETWEEN 1 AND 900000),
  waveform JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, position)
);

-- ---- per-actor messaging privacy -------------------------------------
CREATE TABLE greenfield_messaging_privacy (
  actor_id TEXT PRIMARY KEY REFERENCES actors(id),
  read_receipts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  typing_indicators_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  presence_visibility TEXT NOT NULL DEFAULT 'contacts' CHECK (presence_visibility IN ('contacts', 'nobody')),
  notification_preview TEXT NOT NULL DEFAULT 'full' CHECK (notification_preview IN ('full', 'name_only', 'none')),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- presence --------------------------------------------------------
CREATE TABLE greenfield_actor_presence (
  actor_id TEXT PRIMARY KEY REFERENCES actors(id),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_message_mentions, greenfield_message_attachments, greenfield_messaging_privacy, greenfield_actor_presence TO modula_api, modula_worker;
GRANT SELECT ON greenfield_message_mentions, greenfield_message_attachments, greenfield_messaging_privacy, greenfield_actor_presence TO modula_backup;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '089')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
