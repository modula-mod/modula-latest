-- Phase 6R: Greenfield sovereign account, repository, extension and checkpoint core.
CREATE TABLE greenfield_accounts (
  account_id TEXT PRIMARY KEY, primary_handle TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('pendingVerification','active','suspended','deactivated','deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE greenfield_handles (
  handle TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active','released','reserved')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE greenfield_handle_history (
  history_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id), handle TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('claimed','changed','released')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE greenfield_reserved_handles (handle TEXT PRIMARY KEY, reason TEXT NOT NULL DEFAULT 'reserved', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO greenfield_reserved_handles (handle, reason) VALUES
 ('admin','system'),('api','system'),('help','system'),('modula','system'),('root','system'),('support','system'),('system','system')
ON CONFLICT DO NOTHING;
CREATE TABLE greenfield_auth_identities (
  identity_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('email','passkey','oidc')), identifier TEXT NOT NULL, verified_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(kind, identifier)
);
CREATE TABLE greenfield_password_credentials (
  account_id TEXT PRIMARY KEY REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE, password_hash TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE greenfield_passkeys (
  passkey_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE, public_key BYTEA NOT NULL, counter BIGINT NOT NULL DEFAULT 0, transports JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_used_at TIMESTAMPTZ
);
CREATE TABLE greenfield_email_verifications (
  verification_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE greenfield_recovery_tokens (
  token_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE greenfield_sessions (
  session_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active','revoked','expired')), family_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ, last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), user_agent TEXT, ip_hash TEXT
);
CREATE TABLE greenfield_session_tokens (
  token_id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES greenfield_sessions(session_id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('access','refresh')), token_hash TEXT NOT NULL UNIQUE, family_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL, rotated_at TIMESTAMPTZ, reused_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE greenfield_session_events (
  event_id TEXT PRIMARY KEY, session_id TEXT REFERENCES greenfield_sessions(session_id) ON DELETE SET NULL, account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  event_type TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE greenfield_repositories (
  repository_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  name TEXT NOT NULL, head_hash TEXT, revision BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(account_id,name)
);
CREATE TABLE greenfield_collections (
  collection_id TEXT PRIMARY KEY, repository_id TEXT NOT NULL REFERENCES greenfield_repositories(repository_id) ON DELETE CASCADE,
  name TEXT NOT NULL, schema_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(repository_id,name)
);
CREATE TABLE greenfield_records (
  record_id TEXT PRIMARY KEY, repository_id TEXT NOT NULL REFERENCES greenfield_repositories(repository_id) ON DELETE CASCADE,
  collection TEXT NOT NULL, schema_id TEXT NOT NULL, schema_version INTEGER NOT NULL, visibility TEXT NOT NULL CHECK (visibility IN ('public','followers','teams','private','system')),
  data JSONB NOT NULL, revision BIGINT NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ
);
CREATE TABLE greenfield_record_events (
  event_id TEXT PRIMARY KEY, record_id TEXT NOT NULL REFERENCES greenfield_records(record_id) ON DELETE CASCADE, repository_id TEXT NOT NULL REFERENCES greenfield_repositories(repository_id) ON DELETE CASCADE,
  operation TEXT NOT NULL CHECK (operation IN ('create','update','delete')), revision BIGINT NOT NULL, previous_hash TEXT, event_hash TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE greenfield_checkpoints (
  checkpoint_id TEXT PRIMARY KEY, repository_id TEXT NOT NULL REFERENCES greenfield_repositories(repository_id) ON DELETE CASCADE,
  head_hash TEXT NOT NULL, revision BIGINT NOT NULL, signature TEXT NOT NULL, public_key TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE greenfield_schemas (
  schema_id TEXT PRIMARY KEY, owner TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE greenfield_schema_versions (
  schema_version_id TEXT PRIMARY KEY, schema_id TEXT NOT NULL REFERENCES greenfield_schemas(schema_id) ON DELETE CASCADE, version INTEGER NOT NULL,
  definition JSONB NOT NULL, visibility_allowance JSONB NOT NULL, validation_limits JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(schema_id,version)
);
CREATE TABLE greenfield_extensions (
  extension_id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, publisher_account_id TEXT REFERENCES greenfield_accounts(account_id), status TEXT NOT NULL DEFAULT 'draft', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE greenfield_extension_versions (
  extension_version_id TEXT PRIMARY KEY, extension_id TEXT NOT NULL REFERENCES greenfield_extensions(extension_id) ON DELETE CASCADE, version TEXT NOT NULL, manifest JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'draft', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(extension_id,version)
);
CREATE TABLE greenfield_extension_installations (
  installation_id TEXT PRIMARY KEY, extension_version_id TEXT NOT NULL REFERENCES greenfield_extension_versions(extension_version_id), account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id), status TEXT NOT NULL DEFAULT 'active', config JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(extension_version_id,account_id)
);
CREATE TABLE greenfield_extension_capabilities (
  capability_id TEXT PRIMARY KEY, installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE, capability TEXT NOT NULL, granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), revoked_at TIMESTAMPTZ, UNIQUE(installation_id,capability)
);
CREATE TABLE greenfield_functions (
  function_id TEXT PRIMARY KEY, extension_version_id TEXT REFERENCES greenfield_extension_versions(extension_version_id) ON DELETE CASCADE, name TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('remoteHttp','background','native')), config JSONB NOT NULL DEFAULT '{}'::jsonb, timeout_ms INTEGER NOT NULL DEFAULT 10000, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE greenfield_tools (tool_id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, availability TEXT NOT NULL, manifest JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE greenfield_plugins (plugin_id TEXT PRIMARY KEY, extension_version_id TEXT REFERENCES greenfield_extension_versions(extension_version_id), manifest JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE greenfield_connectors (connector_id TEXT PRIMARY KEY, extension_version_id TEXT REFERENCES greenfield_extension_versions(extension_version_id), manifest JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE greenfield_widgets (widget_id TEXT PRIMARY KEY, extension_version_id TEXT REFERENCES greenfield_extension_versions(extension_version_id), manifest JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE greenfield_bridges (bridge_id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, status TEXT NOT NULL, config JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE greenfield_repository_exports (export_id TEXT PRIMARY KEY, repository_id TEXT NOT NULL REFERENCES greenfield_repositories(repository_id), status TEXT NOT NULL, location TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ);
ALTER TABLE actors ADD COLUMN IF NOT EXISTS account_id TEXT REFERENCES greenfield_accounts(account_id);
CREATE INDEX IF NOT EXISTS actors_account_id_idx ON actors(account_id);
CREATE INDEX greenfield_handles_account_idx ON greenfield_handles(account_id) WHERE status = 'active';
CREATE INDEX greenfield_session_tokens_session_idx ON greenfield_session_tokens(session_id);
CREATE INDEX greenfield_records_repository_idx ON greenfield_records(repository_id, collection) WHERE deleted_at IS NULL;
CREATE INDEX greenfield_record_events_repository_idx ON greenfield_record_events(repository_id, revision);
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO modula_api, modula_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO modula_api, modula_worker;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','004') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();

-- First-party Composer tools and optional AT bridge (disabled by default).
INSERT INTO greenfield_tools (tool_id, slug, display_name, availability, manifest, created_at, updated_at) VALUES
 ('01900000-0000-7000-8000-000000000001','modula.tool.photo','Photo','active','{"toolId":"modula.tool.photo","name":"Photo","surfaces":["composer"],"firstParty":true}',NOW(),NOW()),
 ('01900000-0000-7000-8000-000000000002','modula.tool.camera','Camera','active','{"toolId":"modula.tool.camera","name":"Camera","surfaces":["composer"],"firstParty":true}',NOW(),NOW()),
 ('01900000-0000-7000-8000-000000000003','modula.tool.poll','Poll','preview','{"toolId":"modula.tool.poll","name":"Poll","surfaces":["composer"],"firstParty":true}',NOW(),NOW()),
 ('01900000-0000-7000-8000-000000000004','modula.tool.link','Link','active','{"toolId":"modula.tool.link","name":"Link","surfaces":["composer"],"firstParty":true}',NOW(),NOW()),
 ('01900000-0000-7000-8000-000000000005','modula.tool.commentToDm','Comment to DM','preview','{"toolId":"modula.tool.commentToDm","name":"Comment to DM","surfaces":["composer"],"firstParty":true}',NOW(),NOW()),
 ('01900000-0000-7000-8000-000000000006','modula.tool.automation','Automation','preview','{"toolId":"modula.tool.automation","name":"Automation","surfaces":["composer"],"firstParty":true}',NOW(),NOW()),
 ('01900000-0000-7000-8000-000000000007','modula.tool.aiAssist','AI Assist','preview','{"toolId":"modula.tool.aiAssist","name":"AI Assist","surfaces":["composer"],"firstParty":true}',NOW(),NOW()),
 ('01900000-0000-7000-8000-000000000008','modula.tool.saveToVault','Save to Vault','unavailable','{"toolId":"modula.tool.saveToVault","name":"Save to Vault","surfaces":["composer"],"requiresModule":"vault-notes","firstParty":true}',NOW(),NOW()),
 ('01900000-0000-7000-8000-000000000009','modula.tool.createTask','Create Task','unavailable','{"toolId":"modula.tool.createTask","name":"Create Task","surfaces":["composer"],"requiresModule":"tasks","firstParty":true}',NOW(),NOW())
ON CONFLICT (slug) DO NOTHING;

INSERT INTO greenfield_bridges (bridge_id, slug, status, config, created_at) VALUES
 ('01900000-0000-7000-8000-0000000000a1','atproto','disabled','{"optional":true,"ownsAccounts":false}',NOW())
ON CONFLICT (slug) DO NOTHING;
