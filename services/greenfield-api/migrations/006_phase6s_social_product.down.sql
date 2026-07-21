DELETE FROM greenfield_functions WHERE function_id IN (
  'modula.function.linkPreview','modula.function.extractMentions',
  'modula.function.generatePostSummaryPreview','modula.function.validateMediaMetadata'
);
DROP TABLE IF EXISTS greenfield_function_jobs;
DROP TABLE IF EXISTS greenfield_extension_failures;
DROP TABLE IF EXISTS greenfield_extension_lifecycle_events;
DROP TABLE IF EXISTS greenfield_extension_catalogue;
DROP TABLE IF EXISTS greenfield_appearance_preferences;
DROP TABLE IF EXISTS greenfield_notification_delivery;
DROP TABLE IF EXISTS greenfield_notification_batches;
DROP TABLE IF EXISTS greenfield_mentions;
DROP TABLE IF EXISTS greenfield_quote_posts;
DROP TABLE IF EXISTS greenfield_comment_reactions;
DROP TABLE IF EXISTS greenfield_comments;
DROP TABLE IF EXISTS greenfield_reactions;
ALTER TABLE notification_preferences DROP COLUMN IF EXISTS extension_enabled;
ALTER TABLE notification_preferences DROP COLUMN IF EXISTS quote_enabled;
ALTER TABLE notification_preferences DROP COLUMN IF EXISTS comment_enabled;
ALTER TABLE notification_preferences DROP COLUMN IF EXISTS reaction_enabled;
ALTER TABLE notifications DROP COLUMN IF EXISTS subject_json;
ALTER TABLE notifications DROP COLUMN IF EXISTS kind;
ALTER TABLE posts DROP COLUMN IF EXISTS quote_count;
ALTER TABLE posts DROP COLUMN IF EXISTS reaction_count;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','005') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
