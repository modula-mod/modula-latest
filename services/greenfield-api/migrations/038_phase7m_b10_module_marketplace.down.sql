DROP TABLE IF EXISTS greenfield_module_ratings;

UPDATE schema_metadata
SET value = '037', updated_at = NOW()
WHERE key = 'schema_version';
