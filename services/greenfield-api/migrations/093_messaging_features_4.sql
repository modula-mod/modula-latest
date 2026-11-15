-- 093: messaging features 4 — pinned messages, saved messages, edit history,
-- scheduled messages, disappearing messages, synced chat folders and pins,
-- per-chat notification levels, quick replies, forwarding attribution and
-- shared chat themes. Every feature is advertised in
-- /v1/messaging/capabilities and has an env switch.

-- ---- message columns -----------------------------------------------------
ALTER TABLE greenfield_conversation_messages
  ADD COLUMN forwarded_from_message_id TEXT,
  ADD COLUMN forwarded_from_actor_id TEXT REFERENCES actors(id),
  ADD COLUMN forwarded_from_sent_at TIMESTAMPTZ,
  ADD COLUMN expires_at TIMESTAMPTZ;
CREATE INDEX greenfield_conversation_messages_expiry_idx
  ON greenfield_conversation_messages (expires_at)
  WHERE expires_at IS NOT NULL AND deleted_at IS NULL;

-- ---- conversation-level shared settings ----------------------------------
ALTER TABLE greenfield_conversations
  ADD COLUMN disappearing_ttl_seconds INTEGER
    CHECK (disappearing_ttl_seconds IS NULL OR disappearing_ttl_seconds IN (3600, 86400, 604800, 7776000)),
  ADD COLUMN theme TEXT CHECK (theme IS NULL OR theme ~ '^[a-z][a-z0-9-]{0,31}$');

-- ---- per-member settings ---------------------------------------------------
ALTER TABLE greenfield_conversation_members
  ADD COLUMN pinned_at TIMESTAMPTZ,
  ADD COLUMN notify_level TEXT NOT NULL DEFAULT 'all' CHECK (notify_level IN ('all', 'mentions', 'none'));

-- ---- pinned messages (shared per conversation) -----------------------------
CREATE TABLE greenfield_message_pins (
  conversation_id TEXT NOT NULL REFERENCES greenfield_conversations(conversation_id) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES greenfield_conversation_messages(message_id) ON DELETE CASCADE,
  pinned_by_actor_id TEXT NOT NULL REFERENCES actors(id),
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, message_id)
);

-- ---- saved messages (per actor, synced) ------------------------------------
CREATE TABLE greenfield_saved_messages (
  actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES greenfield_conversation_messages(message_id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES greenfield_conversations(conversation_id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (actor_id, message_id)
);
CREATE INDEX greenfield_saved_messages_actor_idx ON greenfield_saved_messages (actor_id, saved_at DESC, message_id DESC);

-- ---- edit history ----------------------------------------------------------
CREATE TABLE greenfield_message_edits (
  edit_id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES greenfield_conversation_messages(message_id) ON DELETE CASCADE,
  previous_body TEXT NOT NULL,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_message_edits_message_idx ON greenfield_message_edits (message_id, edited_at);

-- ---- scheduled messages ----------------------------------------------------
CREATE TABLE greenfield_scheduled_messages (
  scheduled_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES greenfield_conversations(conversation_id) ON DELETE CASCADE,
  sender_actor_id TEXT NOT NULL REFERENCES actors(id),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  reply_to_message_id TEXT,
  send_at TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  sent_message_id TEXT,
  failure_reason TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_scheduled_messages_due_idx ON greenfield_scheduled_messages (send_at) WHERE state = 'pending';
CREATE INDEX greenfield_scheduled_messages_sender_idx ON greenfield_scheduled_messages (sender_actor_id, state, send_at);

-- ---- chat folders (per actor, synced) --------------------------------------
CREATE TABLE greenfield_chat_folders (
  folder_id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 32),
  emoji TEXT CHECK (emoji IS NULL OR char_length(emoji) <= 16),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_chat_folders_actor_idx ON greenfield_chat_folders (actor_id, sort_order);
CREATE TABLE greenfield_chat_folder_items (
  folder_id TEXT NOT NULL REFERENCES greenfield_chat_folders(folder_id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES greenfield_conversations(conversation_id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (folder_id, conversation_id)
);

-- ---- quick replies (per actor) ---------------------------------------------
CREATE TABLE greenfield_quick_replies (
  reply_id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  shortcut TEXT NOT NULL CHECK (shortcut ~ '^[a-z0-9_-]{1,24}$'),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (actor_id, shortcut)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  greenfield_message_pins, greenfield_saved_messages, greenfield_message_edits, greenfield_scheduled_messages,
  greenfield_chat_folders, greenfield_chat_folder_items, greenfield_quick_replies
  TO modula_api, modula_worker;
GRANT SELECT ON
  greenfield_message_pins, greenfield_saved_messages, greenfield_message_edits, greenfield_scheduled_messages,
  greenfield_chat_folders, greenfield_chat_folder_items, greenfield_quick_replies
  TO modula_backup;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '093')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
