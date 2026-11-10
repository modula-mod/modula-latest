-- Rolling back removes group conversations and attachment-only messages,
-- because the restored 081 constraints cannot represent them.
DROP TABLE IF EXISTS greenfield_actor_presence;
DROP TABLE IF EXISTS greenfield_messaging_privacy;
DROP TABLE IF EXISTS greenfield_message_attachments;
DROP TABLE IF EXISTS greenfield_message_mentions;

DROP INDEX IF EXISTS greenfield_conversation_messages_search_idx;
DROP INDEX IF EXISTS greenfield_conversation_messages_client_id_idx;
DELETE FROM greenfield_conversations WHERE kind = 'group';
DELETE FROM greenfield_conversation_messages WHERE message_kind <> 'text' OR char_length(body) < 1;
ALTER TABLE greenfield_conversation_messages DROP CONSTRAINT IF EXISTS greenfield_conversation_messages_body_check;
ALTER TABLE greenfield_conversation_messages
  DROP COLUMN IF EXISTS message_kind,
  DROP COLUMN IF EXISTS client_message_id,
  ADD CONSTRAINT greenfield_conversation_messages_body_check CHECK (char_length(body) BETWEEN 1 AND 20000);

DROP INDEX IF EXISTS greenfield_conversation_members_conv_state_idx;
UPDATE greenfield_conversation_members SET state = 'declined' WHERE state IN ('left', 'removed');
ALTER TABLE greenfield_conversation_members DROP CONSTRAINT IF EXISTS greenfield_conversation_members_state_check;
ALTER TABLE greenfield_conversation_members
  DROP COLUMN IF EXISTS role,
  DROP COLUMN IF EXISTS added_by_actor_id,
  ADD CONSTRAINT greenfield_conversation_members_state_check CHECK (state IN ('active', 'pending', 'declined'));

ALTER TABLE greenfield_conversations DROP CONSTRAINT IF EXISTS greenfield_conversations_group_title_check;
ALTER TABLE greenfield_conversations DROP CONSTRAINT IF EXISTS greenfield_conversations_kind_check;
ALTER TABLE greenfield_conversations
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS description,
  ADD CONSTRAINT greenfield_conversations_kind_check CHECK (kind IN ('direct', 'inmail'));

UPDATE schema_metadata SET value = '088', updated_at = NOW() WHERE key = 'schema_version';
