DROP TRIGGER IF EXISTS greenfield_module_record_revisions_immutable ON greenfield_module_record_revisions;
DROP FUNCTION IF EXISTS prevent_module_record_revision_mutation();

DROP TABLE IF EXISTS greenfield_module_record_changes;
DROP TABLE IF EXISTS greenfield_module_record_references;
DROP TABLE IF EXISTS greenfield_module_record_mutations;
DROP TABLE IF EXISTS greenfield_module_record_revisions;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '067')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
