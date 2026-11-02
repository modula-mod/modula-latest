-- Messaging v2: reactions, reply-to, edit and unsend, typing, mute and archive.
-- Additive only: nullable columns on existing messaging tables plus one new table.
ALTER TABLE greenfield_conversation_messages
  ADD COLUMN reply_to_message_id TEXT REFERENCES greenfield_conversation_messages(message_id) ON DELETE SET NULL,
  ADD COLUMN edited_at TIMESTAMPTZ,
  ADD COLUMN deleted_at TIMESTAMPTZ;

ALTER TABLE greenfield_conversation_members
  ADD COLUMN muted_until TIMESTAMPTZ,
  ADD COLUMN archived_at TIMESTAMPTZ,
  ADD COLUMN typing_at TIMESTAMPTZ;

CREATE TABLE greenfield_message_reactions (
  message_id TEXT NOT NULL REFERENCES greenfield_conversation_messages(message_id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  emoji TEXT NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, actor_id, emoji)
);
CREATE INDEX greenfield_message_reactions_message_idx ON greenfield_message_reactions(message_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_message_reactions TO modula_api, modula_worker;
GRANT SELECT ON greenfield_message_reactions TO modula_backup;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '081')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
