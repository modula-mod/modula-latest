-- Phase 7I-F5B: marker migration for deterministic rollback compatibility.
-- Its down migration normalizes newer mail template IDs before older Phase 7I
-- down migrations restore narrower template constraints.

INSERT INTO schema_metadata (key,value)
VALUES ('schema_version','037')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
