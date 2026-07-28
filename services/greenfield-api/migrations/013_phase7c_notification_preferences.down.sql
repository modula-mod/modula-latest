ALTER TABLE notification_preferences ALTER COLUMN module_event_enabled SET DEFAULT TRUE;
ALTER TABLE notification_preferences ALTER COLUMN extension_enabled SET DEFAULT TRUE;
ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_bundle_style_check;
ALTER TABLE notification_preferences DROP COLUMN IF EXISTS bundle_style;

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','012')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
