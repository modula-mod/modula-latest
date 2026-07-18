-- Data-only convergence migration. Rollback records the prior schema marker only.
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','006') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
