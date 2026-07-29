DROP TABLE IF EXISTS greenfield_ai_streams;
DROP TABLE IF EXISTS greenfield_ai_tool_runs;
DROP TABLE IF EXISTS greenfield_ai_tool_declarations;
DROP TABLE IF EXISTS greenfield_ai_request_ledger;
DROP TABLE IF EXISTS greenfield_ai_prompts;
DROP TABLE IF EXISTS greenfield_ai_models;
DROP TABLE IF EXISTS greenfield_ai_providers;

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','023')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
