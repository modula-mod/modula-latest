DROP INDEX IF EXISTS notifications_category_created_idx;
DROP INDEX IF EXISTS notifications_recipient_dedupe_uidx;
DROP INDEX IF EXISTS audit_events_action_result_idx;
DROP INDEX IF EXISTS audit_events_request_idx;
DROP INDEX IF EXISTS audit_events_account_created_idx;
DROP INDEX IF EXISTS audit_events_audit_id_uidx;
DROP INDEX IF EXISTS greenfield_policy_decision_audit_denied_idx;
DROP INDEX IF EXISTS greenfield_policy_decision_audit_actor_idx;

ALTER TABLE notification_preferences
  DROP COLUMN IF EXISTS dimon_transaction_confirmation_enabled,
  DROP COLUMN IF EXISTS automation_failure_enabled,
  DROP COLUMN IF EXISTS ai_completion_enabled,
  DROP COLUMN IF EXISTS connector_failure_enabled,
  DROP COLUMN IF EXISTS module_preferences,
  DROP COLUMN IF EXISTS category_preferences,
  DROP COLUMN IF EXISTS channel_preferences,
  DROP COLUMN IF EXISTS quiet_hours,
  DROP COLUMN IF EXISTS digest_mode,
  DROP COLUMN IF EXISTS frequency,
  DROP COLUMN IF EXISTS web_push_enabled,
  DROP COLUMN IF EXISTS email_enabled,
  DROP COLUMN IF EXISTS in_app_enabled;

ALTER TABLE notifications
  DROP COLUMN IF EXISTS last_aggregated_at,
  DROP COLUMN IF EXISTS aggregate_window_started_at,
  DROP COLUMN IF EXISTS aggregate_count,
  DROP COLUMN IF EXISTS dedupe_key,
  DROP COLUMN IF EXISTS channels,
  DROP COLUMN IF EXISTS category;

ALTER TABLE audit_events
  DROP COLUMN IF EXISTS metadata_schema_version,
  DROP COLUMN IF EXISTS user_agent_classification,
  DROP COLUMN IF EXISTS ip_classification,
  DROP COLUMN IF EXISTS correlation_id,
  DROP COLUMN IF EXISTS request_id,
  DROP COLUMN IF EXISTS result,
  DROP COLUMN IF EXISTS action,
  DROP COLUMN IF EXISTS account_id,
  DROP COLUMN IF EXISTS audit_id;

DROP TABLE IF EXISTS greenfield_policy_decision_audit;

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','019')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
