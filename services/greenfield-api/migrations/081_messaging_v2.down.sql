DROP TABLE IF EXISTS greenfield_message_reactions;
ALTER TABLE greenfield_conversation_members
  DROP COLUMN IF EXISTS muted_until,
  DROP COLUMN IF EXISTS archived_at,
  DROP COLUMN IF EXISTS typing_at;
ALTER TABLE greenfield_conversation_messages
  DROP COLUMN IF EXISTS reply_to_message_id,
  DROP COLUMN IF EXISTS edited_at,
  DROP COLUMN IF EXISTS deleted_at;
UPDATE schema_metadata SET value = '080', updated_at = NOW() WHERE key = 'schema_version';
