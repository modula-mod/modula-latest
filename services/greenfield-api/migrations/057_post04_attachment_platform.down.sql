DROP TABLE IF EXISTS post_content;
DROP TABLE IF EXISTS attachment_upload_sessions;
DROP TABLE IF EXISTS attachments;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '056')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
