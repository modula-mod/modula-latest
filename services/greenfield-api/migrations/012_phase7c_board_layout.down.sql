DROP TABLE IF EXISTS greenfield_board_layouts;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','011') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
