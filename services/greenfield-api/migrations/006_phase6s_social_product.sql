-- Phase 6S: Greenfield social product primitives.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reaction_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS quote_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE greenfield_reactions (
  reaction_id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES actors(id), post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like','love','celebrate','insightful','support','funny')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(actor_id, post_id)
);
CREATE INDEX greenfield_reactions_post_idx ON greenfield_reactions(post_id);
CREATE INDEX greenfield_reactions_actor_idx ON greenfield_reactions(actor_id);
CREATE INDEX greenfield_reactions_type_idx ON greenfield_reactions(reaction_type);
CREATE INDEX greenfield_reactions_created_idx ON greenfield_reactions(created_at DESC);

CREATE TABLE greenfield_comments (
  comment_id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_actor_id TEXT NOT NULL REFERENCES actors(id), parent_comment_id TEXT REFERENCES greenfield_comments(comment_id),
  root_comment_id TEXT REFERENCES greenfield_comments(comment_id), text TEXT NOT NULL, depth INTEGER NOT NULL CHECK (depth BETWEEN 0 AND 4),
  reply_count INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ, deletion_kind TEXT CHECK (deletion_kind IN ('user','moderation'))
);
CREATE INDEX greenfield_comments_post_idx ON greenfield_comments(post_id, created_at);
CREATE INDEX greenfield_comments_parent_idx ON greenfield_comments(parent_comment_id, created_at);

CREATE TABLE greenfield_comment_reactions (
  reaction_id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES actors(id), comment_id TEXT NOT NULL REFERENCES greenfield_comments(comment_id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like','love','celebrate','insightful','support','funny')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(actor_id, comment_id)
);
CREATE INDEX greenfield_comment_reactions_comment_idx ON greenfield_comment_reactions(comment_id);
CREATE INDEX greenfield_comment_reactions_actor_idx ON greenfield_comment_reactions(actor_id);

CREATE TABLE greenfield_quote_posts (
  post_id TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE, quoted_post_id TEXT NOT NULL REFERENCES posts(id),
  commentary TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_quote_posts_quoted_idx ON greenfield_quote_posts(quoted_post_id);

CREATE TABLE greenfield_mentions (
  mention_id TEXT PRIMARY KEY, source_type TEXT NOT NULL CHECK (source_type IN ('post','comment')), source_id TEXT NOT NULL,
  mentioned_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id), mentioned_actor_id TEXT REFERENCES actors(id),
  handle_at_mention TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_mentions_source_idx ON greenfield_mentions(source_type, source_id);
CREATE INDEX greenfield_mentions_account_idx ON greenfield_mentions(mentioned_account_id);

CREATE TABLE greenfield_notification_batches (
  batch_id TEXT PRIMARY KEY, recipient_actor_id TEXT NOT NULL REFERENCES actors(id), kind TEXT NOT NULL, subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL, batch_key TEXT NOT NULL UNIQUE, actor_ids JSONB NOT NULL DEFAULT '[]'::jsonb, count INTEGER NOT NULL DEFAULT 0,
  preview_text TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE greenfield_notification_delivery (
  delivery_id TEXT PRIMARY KEY, notification_id TEXT REFERENCES notifications(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES greenfield_notification_batches(batch_id) ON DELETE CASCADE, channel TEXT NOT NULL CHECK (channel IN ('inApp')),
  status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (notification_id IS NOT NULL OR batch_id IS NOT NULL)
);

CREATE TABLE greenfield_appearance_preferences (
  account_id TEXT PRIMARY KEY REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'system' CHECK (mode IN ('system','light','dim','dark','oled')),
  variant TEXT NOT NULL DEFAULT 'standard' CHECK (variant IN ('standard','forest','ocean','plum','espresso','spaceGray')),
  surface TEXT NOT NULL DEFAULT 'native' CHECK (surface IN ('native','solid','glass','glay','minimalSpatial','skeuomorphic','neomorphic')),
  accent_id TEXT NOT NULL DEFAULT 'modula', custom_accent TEXT, text_scale NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (text_scale BETWEEN 0.85 AND 1.60),
  bold_text BOOLEAN NOT NULL DEFAULT FALSE, reduce_motion BOOLEAN NOT NULL DEFAULT FALSE, reduce_transparency BOOLEAN NOT NULL DEFAULT FALSE,
  increase_contrast BOOLEAN NOT NULL DEFAULT FALSE, version INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE greenfield_extension_catalogue (
  extension_id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL,
  version TEXT NOT NULL, publisher TEXT NOT NULL, trust TEXT NOT NULL, permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  compatibility JSONB NOT NULL DEFAULT '{}'::jsonb, manifest JSONB NOT NULL DEFAULT '{}'::jsonb, catalogue_status TEXT NOT NULL,
  executable BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE greenfield_extension_lifecycle_events (
  event_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id), extension_id TEXT NOT NULL,
  event TEXT NOT NULL, from_status TEXT, to_status TEXT, detail JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE greenfield_extension_failures (
  failure_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id), extension_id TEXT NOT NULL,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE SET NULL, code TEXT NOT NULL,
  message TEXT NOT NULL, retryable BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE greenfield_function_jobs (
  job_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id), function_id TEXT NOT NULL REFERENCES greenfield_functions(function_id),
  status TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed','cancelled','expired')), input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB, error_message TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, expires_at TIMESTAMPTZ NOT NULL
);

INSERT INTO greenfield_reactions (reaction_id, actor_id, post_id, reaction_type, created_at, updated_at)
SELECT 'reaction-' || id, actor_id, post_id, 'like', created_at, updated_at FROM post_likes WHERE deleted_at IS NULL
ON CONFLICT (actor_id, post_id) DO NOTHING;
UPDATE posts SET reaction_count = like_count;

-- Existing notification consumers keep `type`; Greenfield consumers use flexible `kind` and subject JSON.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS subject_json JSONB;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS reaction_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS comment_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS quote_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS extension_enabled BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO greenfield_extension_catalogue (extension_id,slug,kind,name,description,version,publisher,trust,catalogue_status,executable) VALUES
('modula.core.composerTools','modula.core.composerTools','plugin','Composer Tools','First-party composer tools','1.0.0','Modula','firstParty','active',TRUE),
('modula.core.mediaFunctions','modula.core.mediaFunctions','plugin','Media Functions','First-party media functions','1.0.0','Modula','firstParty','active',TRUE),
('modula.core.moderationPlugin','modula.core.moderationPlugin','plugin','Moderation','First-party moderation plugin','1.0.0','Modula','firstParty','active',TRUE),
('modula.core.notificationPlugin','modula.core.notificationPlugin','plugin','Notifications','First-party notification plugin','1.0.0','Modula','firstParty','active',TRUE),
('modula.core.appearanceSyncPlugin','modula.core.appearanceSyncPlugin','plugin','Appearance Sync','First-party appearance preferences sync','1.0.0','Modula','firstParty','active',TRUE),
('modula.bridge.atprotocol','modula.bridge.atprotocol','bridge','AT Protocol','Optional AT Protocol bridge','1.0.0','Modula','firstParty','disabled',FALSE),
('modula.module.vaultNotes','modula.module.vaultNotes','module','Vault Notes','Optional Vault Notes module','1.0.0','Modula','firstParty','unavailable',FALSE),
('modula.module.tasks','modula.module.tasks','module','Tasks','Optional Tasks module','1.0.0','Modula','firstParty','unavailable',FALSE),
('modula.module.dimon','modula.module.dimon','module','Dimon','Optional Dimon module','1.0.0','Modula','firstParty','inactive',FALSE)
ON CONFLICT (slug) DO NOTHING;
INSERT INTO greenfield_functions (function_id,extension_version_id,name,kind,config,timeout_ms) VALUES
('modula.function.linkPreview',NULL,'Link preview','background','{}',10000),
('modula.function.extractMentions',NULL,'Extract mentions','background','{}',10000),
('modula.function.generatePostSummaryPreview',NULL,'Generate post summary preview','background','{}',10000),
('modula.function.validateMediaMetadata',NULL,'Validate media metadata','background','{}',10000)
ON CONFLICT (function_id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO modula_api, modula_worker;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','006') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
