DROP TRIGGER IF EXISTS greenfield_game_catalogue_events_immutable ON greenfield_game_catalogue_events;
DROP FUNCTION IF EXISTS greenfield_reject_game_catalogue_event_mutation();
DROP TABLE IF EXISTS greenfield_game_catalogue_events;
DROP TABLE IF EXISTS greenfield_game_catalogue_entries;

UPDATE schema_metadata SET value = '077', updated_at = NOW() WHERE key = 'schema_version';
