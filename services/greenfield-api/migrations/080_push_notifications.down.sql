DROP TRIGGER IF EXISTS notifications_push_enqueue ON notifications;
DROP FUNCTION IF EXISTS push_enqueue_for_notification();
DROP FUNCTION IF EXISTS push_category_for_notification(TEXT, TEXT, TEXT, TEXT);
DROP TABLE IF EXISTS push_deliveries;
DROP TABLE IF EXISTS push_notification_preferences;
DROP TABLE IF EXISTS push_device_tokens;
UPDATE schema_metadata SET value = '079', updated_at = NOW() WHERE key = 'schema_version';
