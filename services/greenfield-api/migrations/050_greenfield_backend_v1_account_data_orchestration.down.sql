DROP TABLE IF EXISTS greenfield_account_deletion_tombstones;
DROP TABLE IF EXISTS greenfield_account_data_artifacts;
DROP TABLE IF EXISTS greenfield_account_data_request_domains;
DROP TABLE IF EXISTS greenfield_account_data_requests;
UPDATE schema_metadata SET value='049', updated_at=NOW() WHERE key='schema_version';
