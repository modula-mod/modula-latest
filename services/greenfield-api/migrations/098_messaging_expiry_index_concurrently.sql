-- modula:migrate no-transaction
-- 098: partial expiry index for the disappearing-message sweeper, built
-- CONCURRENTLY so writes to the existing greenfield_conversation_messages table
-- are not blocked during the build. The runner executes each statement on its
-- own in autocommit mode (see NO_TRANSACTION_DIRECTIVE in src/database/migrate.ts).
--
-- Retry safety: if a previous attempt failed part-way, its ledger row is absent
-- and an INVALID index may be left behind; the first statement removes it so a
-- re-run rebuilds the index cleanly.
DROP INDEX CONCURRENTLY IF EXISTS greenfield_conversation_messages_expiry_idx;
CREATE INDEX CONCURRENTLY greenfield_conversation_messages_expiry_idx
  ON greenfield_conversation_messages (expires_at)
  WHERE expires_at IS NOT NULL AND deleted_at IS NULL;
INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '098')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
