-- Rollback for 090: removes call history, VoIP registrations and call settings.
DROP TABLE IF EXISTS greenfield_call_device_invitations;
DROP TABLE IF EXISTS greenfield_call_push_tokens;
DROP TABLE IF EXISTS greenfield_call_signalling_tickets;
DROP TABLE IF EXISTS greenfield_call_events;
DROP TABLE IF EXISTS greenfield_call_participants;
DROP TABLE IF EXISTS greenfield_call_settings;
DROP TABLE IF EXISTS greenfield_calls;

UPDATE schema_metadata SET value = '089', updated_at = NOW() WHERE key = 'schema_version';
