DROP TABLE IF EXISTS greenfield_mail_identity_events;
DROP TABLE IF EXISTS greenfield_mailbox_credentials;
DROP TABLE IF EXISTS greenfield_mail_identity_requests;
DROP TABLE IF EXISTS greenfield_mail_identities;
DROP TABLE IF EXISTS greenfield_reserved_identifiers;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '033')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
