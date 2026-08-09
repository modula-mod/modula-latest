-- Phase 7I-D: runtime role grants for post-021 production restores.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  greenfield_story_groups,
  greenfield_story_items,
  greenfield_story_views
TO modula_api, modula_worker;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  greenfield_mail_jobs
TO modula_api, modula_worker;

GRANT SELECT ON
  greenfield_story_groups,
  greenfield_story_items,
  greenfield_story_views,
  greenfield_mail_jobs
TO modula_backup;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO modula_backup;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '030')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
