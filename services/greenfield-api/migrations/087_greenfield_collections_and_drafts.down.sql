DROP TABLE IF EXISTS greenfield_post_draft_content;
DROP TABLE IF EXISTS greenfield_post_drafts;
DROP TABLE IF EXISTS greenfield_saved_collection_items;
DROP TABLE IF EXISTS greenfield_saved_collections;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '086')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
