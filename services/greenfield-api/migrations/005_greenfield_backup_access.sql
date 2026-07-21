-- Permit the dedicated backup role to include Phase 6R Greenfield tables.
GRANT USAGE ON SCHEMA public TO modula_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO modula_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO modula_backup;
