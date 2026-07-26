DELETE FROM notification_preferences
WHERE id LIKE 'notification-preferences-%'
  AND actor_id IN (
    SELECT id FROM actors WHERE account_id IS NOT NULL
  );

DELETE FROM profiles
WHERE id LIKE 'profile-%'
  AND actor_id IN (
    SELECT id FROM actors WHERE account_id IS NOT NULL
  );

DELETE FROM actors
WHERE id LIKE 'actor-%'
  AND account_id IS NOT NULL;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '013')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
