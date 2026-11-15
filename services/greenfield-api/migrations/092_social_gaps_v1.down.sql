-- Rollback for 092: removes story reactions, highlights and manual unread markers.
DROP TABLE IF EXISTS greenfield_story_highlight_items;
DROP TABLE IF EXISTS greenfield_story_highlights;
DROP TABLE IF EXISTS greenfield_story_reactions;
ALTER TABLE greenfield_conversation_members DROP COLUMN IF EXISTS marked_unread_at;

UPDATE schema_metadata SET value = '091', updated_at = NOW() WHERE key = 'schema_version';
