-- Phase 7C-B: account-backed notification preference persistence.

ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS bundle_style TEXT NOT NULL DEFAULT 'focus';

ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_bundle_style_check;
ALTER TABLE notification_preferences
  ADD CONSTRAINT notification_preferences_bundle_style_check
  CHECK (bundle_style IN ('individual', 'focus', 'digest'));

ALTER TABLE notification_preferences ALTER COLUMN module_event_enabled SET DEFAULT FALSE;
ALTER TABLE notification_preferences ALTER COLUMN extension_enabled SET DEFAULT FALSE;

GRANT SELECT, INSERT, UPDATE ON notification_preferences TO modula_api, modula_worker;

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','013')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
