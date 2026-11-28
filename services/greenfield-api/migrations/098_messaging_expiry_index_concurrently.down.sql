-- modula:migrate no-transaction
-- Rollback for 098: drops the disappearing-message expiry index without
-- blocking writes to greenfield_conversation_messages.
DROP INDEX CONCURRENTLY IF EXISTS greenfield_conversation_messages_expiry_idx;
INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '097')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
