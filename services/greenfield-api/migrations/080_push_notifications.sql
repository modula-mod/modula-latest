-- Push notifications (APNs): device tokens, per-actor push preferences and a
-- durable delivery queue. Additive only. Every in-app notification insert
-- enqueues one push delivery via trigger so all existing producers (worker
-- notification.create / social handlers) are covered without code changes.

CREATE TABLE push_device_tokens (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  token TEXT NOT NULL UNIQUE CHECK (token ~ '^[0-9a-f]{64,200}$'),
  platform TEXT NOT NULL DEFAULT 'ios' CHECK (platform IN ('ios')),
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('development', 'production')),
  bundle_id TEXT NOT NULL,
  app_version TEXT,
  device_name TEXT,
  locale TEXT,
  timezone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at TIMESTAMPTZ,
  disabled_reason TEXT
);
CREATE INDEX push_device_tokens_actor_active_idx ON push_device_tokens(actor_id) WHERE disabled_at IS NULL;

CREATE TABLE push_notification_preferences (
  actor_id TEXT PRIMARY KEY REFERENCES actors(id),
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  likes_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  comments_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  replies_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  mentions_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  follows_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  messages_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  stories_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  moliboo_care_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  gubic_invites_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start TEXT NOT NULL DEFAULT '22:00' CHECK (quiet_hours_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  quiet_hours_end TEXT NOT NULL DEFAULT '07:00' CHECK (quiet_hours_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  timezone TEXT NOT NULL DEFAULT 'UTC' CHECK (char_length(timezone) BETWEEN 1 AND 64),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE push_deliveries (
  id TEXT PRIMARY KEY,
  recipient_actor_id TEXT NOT NULL REFERENCES actors(id),
  notification_id TEXT UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('likes','comments','replies','mentions','follows','messages','stories','moliboo_care','gubic_invites','system')),
  actor_id TEXT,
  title TEXT,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  deep_link TEXT,
  thread_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','suppressed','failed','dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_expires_at TIMESTAMPTZ,
  last_error TEXT,
  sent_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX push_deliveries_due_idx ON push_deliveries(next_attempt_at) WHERE status IN ('queued','sending');

CREATE FUNCTION push_category_for_notification(n_type TEXT, n_resource_type TEXT, n_category TEXT, n_body TEXT) RETURNS TEXT AS $$
BEGIN
  IF n_category IS NOT NULL AND n_category <> 'social' THEN
    IF n_resource_type = 'moliboo' THEN RETURN 'moliboo_care'; END IF;
    IF n_resource_type = 'gubic-invite' THEN RETURN 'gubic_invites'; END IF;
    RETURN NULL;
  END IF;
  IF n_type = 'like' THEN RETURN 'likes'; END IF;
  IF n_type = 'follow' THEN RETURN 'follows'; END IF;
  IF n_type = 'mention' THEN RETURN 'mentions'; END IF;
  IF n_type = 'reply' AND (n_resource_type = 'comment' OR n_body LIKE 'replied to your comment%') THEN RETURN 'replies'; END IF;
  IF n_type = 'reply' THEN RETURN 'comments'; END IF;
  IF n_type = 'module_event' AND n_resource_type = 'story' THEN RETURN 'stories'; END IF;
  IF n_type = 'module_event' AND n_resource_type = 'moliboo' THEN RETURN 'moliboo_care'; END IF;
  IF n_type = 'module_event' AND n_resource_type = 'gubic-invite' THEN RETURN 'gubic_invites'; END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE FUNCTION push_enqueue_for_notification() RETURNS TRIGGER AS $$
DECLARE
  push_category TEXT;
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.read_at IS NOT NULL THEN RETURN NEW; END IF;
  push_category := push_category_for_notification(NEW.type, NEW.resource_type, NEW.category, NEW.body);
  IF push_category IS NULL THEN RETURN NEW; END IF;
  -- Only fan out to actors that have at least one registered device.
  IF NOT EXISTS (SELECT 1 FROM push_device_tokens t WHERE t.actor_id = NEW.recipient_actor_id AND t.disabled_at IS NULL) THEN
    RETURN NEW;
  END IF;
  INSERT INTO push_deliveries (id, recipient_actor_id, notification_id, category, actor_id, body, thread_id, data)
  VALUES (
    gen_random_uuid()::text, NEW.recipient_actor_id, NEW.id, push_category, NEW.actor_id, NEW.body,
    COALESCE(NEW.dedupe_key, push_category || ':' || COALESCE(NEW.resource_id, NEW.id)),
    jsonb_build_object('notificationId', NEW.id, 'type', NEW.type, 'resourceType', NEW.resource_type, 'resourceId', NEW.resource_id)
  )
  ON CONFLICT (notification_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notifications_push_enqueue
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION push_enqueue_for_notification();

GRANT SELECT, INSERT, UPDATE, DELETE ON push_device_tokens, push_notification_preferences, push_deliveries TO modula_api, modula_worker;
GRANT SELECT ON push_device_tokens, push_notification_preferences, push_deliveries TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '080')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
