REVOKE SELECT, INSERT, UPDATE, DELETE ON
  greenfield_story_groups,
  greenfield_story_items,
  greenfield_story_views,
  greenfield_mail_jobs
FROM modula_api, modula_worker;

REVOKE SELECT ON
  greenfield_story_groups,
  greenfield_story_items,
  greenfield_story_views,
  greenfield_mail_jobs
FROM modula_backup;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '029')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
