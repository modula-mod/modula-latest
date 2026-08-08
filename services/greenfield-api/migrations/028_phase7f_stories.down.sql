DROP TABLE IF EXISTS greenfield_story_views;
DROP TABLE IF EXISTS greenfield_story_items;
DROP TABLE IF EXISTS greenfield_story_groups;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '027')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
