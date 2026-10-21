DROP TABLE IF EXISTS greenfield_conversation_messages;
DROP TABLE IF EXISTS greenfield_conversation_members;
DROP TABLE IF EXISTS greenfield_conversations;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '074')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
