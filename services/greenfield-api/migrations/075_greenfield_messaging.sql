-- Messaging: direct chats, message requests and In-Mail threads.
-- Additive only: three new tables, no changes to existing tables.
CREATE TABLE greenfield_conversations (
  conversation_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('direct', 'inmail')),
  subject TEXT CHECK (subject IS NULL OR char_length(subject) <= 180),
  direct_key TEXT UNIQUE,
  created_by_actor_id TEXT NOT NULL REFERENCES actors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_conversations_kind_recent_idx ON greenfield_conversations(kind, last_message_at DESC, conversation_id DESC);

CREATE TABLE greenfield_conversation_members (
  conversation_id TEXT NOT NULL REFERENCES greenfield_conversations(conversation_id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  state TEXT NOT NULL CHECK (state IN ('active', 'pending', 'declined')),
  last_read_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, actor_id)
);
CREATE INDEX greenfield_conversation_members_actor_idx ON greenfield_conversation_members(actor_id, state);

CREATE TABLE greenfield_conversation_messages (
  message_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES greenfield_conversations(conversation_id) ON DELETE CASCADE,
  sender_actor_id TEXT NOT NULL REFERENCES actors(id),
  subject TEXT CHECK (subject IS NULL OR char_length(subject) <= 180),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 20000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_conversation_messages_conv_idx ON greenfield_conversation_messages(conversation_id, created_at DESC, message_id DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_conversations, greenfield_conversation_members, greenfield_conversation_messages TO modula_api, modula_worker;
GRANT SELECT ON greenfield_conversations, greenfield_conversation_members, greenfield_conversation_messages TO modula_backup;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '075')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
