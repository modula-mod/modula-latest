-- Rollback for 093: removes pins, saved messages, edit history, scheduled
-- messages, folders, quick replies and the new message/conversation/member columns.
DROP TABLE IF EXISTS greenfield_quick_replies;
DROP TABLE IF EXISTS greenfield_chat_folder_items;
DROP TABLE IF EXISTS greenfield_chat_folders;
DROP TABLE IF EXISTS greenfield_scheduled_messages;
DROP TABLE IF EXISTS greenfield_message_edits;
DROP TABLE IF EXISTS greenfield_saved_messages;
DROP TABLE IF EXISTS greenfield_message_pins;
ALTER TABLE greenfield_conversation_members DROP COLUMN IF EXISTS notify_level, DROP COLUMN IF EXISTS pinned_at;
ALTER TABLE greenfield_conversations DROP COLUMN IF EXISTS theme, DROP COLUMN IF EXISTS disappearing_ttl_seconds;
DROP INDEX IF EXISTS greenfield_conversation_messages_expiry_idx;
ALTER TABLE greenfield_conversation_messages
  DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS forwarded_from_sent_at,
  DROP COLUMN IF EXISTS forwarded_from_actor_id,
  DROP COLUMN IF EXISTS forwarded_from_message_id;

UPDATE schema_metadata SET value = '092', updated_at = NOW() WHERE key = 'schema_version';
