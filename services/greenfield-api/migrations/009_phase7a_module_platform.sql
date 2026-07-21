-- Phase 7A: Greenfield module platform, immutable releases, provenance and lifecycle.
CREATE TABLE IF NOT EXISTS greenfield_publishers (
  publisher_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  website TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','verified','suspended','revoked')),
  trust_level TEXT NOT NULL CHECK (trust_level IN ('firstParty','verifiedPublisher','reviewedCommunity','untrustedManifest')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS greenfield_publisher_namespaces (
  namespace TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL REFERENCES greenfield_publishers(publisher_id),
  verification_method TEXT NOT NULL,
  verification_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS greenfield_publisher_namespaces_active_unique
  ON greenfield_publisher_namespaces(namespace)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS greenfield_module_versions (
  module_version_id TEXT PRIMARY KEY,
  extension_version_id TEXT NOT NULL UNIQUE REFERENCES greenfield_extension_versions(extension_version_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  version TEXT NOT NULL,
  publisher_id TEXT NOT NULL REFERENCES greenfield_publishers(publisher_id),
  manifest JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','pendingReview','verified','published','quarantined','revoked','superseded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(module_id, version)
);

CREATE TABLE IF NOT EXISTS greenfield_module_releases (
  release_id TEXT PRIMARY KEY,
  module_version_id TEXT NOT NULL UNIQUE REFERENCES greenfield_module_versions(module_version_id) ON DELETE CASCADE,
  extension_id TEXT NOT NULL REFERENCES greenfield_extensions(extension_id) ON DELETE CASCADE,
  extension_version_id TEXT NOT NULL UNIQUE REFERENCES greenfield_extension_versions(extension_version_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  version TEXT NOT NULL,
  publisher_id TEXT NOT NULL REFERENCES greenfield_publishers(publisher_id),
  release_state TEXT NOT NULL CHECK (release_state IN ('draft','pendingReview','verified','published','quarantined','revoked','superseded')),
  source_repository TEXT NOT NULL,
  source_commit TEXT NOT NULL CHECK (source_commit ~ '^[0-9a-fA-F]{40}$'),
  manifest_path TEXT NOT NULL,
  manifest_sha256 TEXT NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-fA-F]{64}$'),
  release_sha256 TEXT CHECK (release_sha256 IS NULL OR release_sha256 ~ '^[0-9a-fA-F]{64}$'),
  signature_key_id TEXT,
  signature TEXT,
  compatibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  license_status TEXT NOT NULL CHECK (license_status IN ('firstParty','verified','declared','founderOverride','unknown','denied')),
  trust_level TEXT NOT NULL CHECK (trust_level IN ('firstParty','verifiedPublisher','reviewedCommunity','untrustedManifest')),
  published_at TIMESTAMPTZ,
  quarantined_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(module_id, version)
);
CREATE INDEX IF NOT EXISTS greenfield_module_releases_module_idx ON greenfield_module_releases(module_id, release_state, version);
CREATE INDEX IF NOT EXISTS greenfield_module_releases_publisher_idx ON greenfield_module_releases(publisher_id, release_state);

CREATE TABLE IF NOT EXISTS greenfield_module_sources (
  source_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL UNIQUE REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('github')),
  repository TEXT NOT NULL,
  repository_id TEXT,
  default_branch TEXT,
  commit TEXT NOT NULL CHECK (commit ~ '^[0-9a-fA-F]{40}$'),
  manifest_path TEXT NOT NULL,
  release_tag TEXT,
  release_asset_name TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  etag TEXT
);

CREATE TABLE IF NOT EXISTS greenfield_module_dependencies (
  dependency_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  dependency_module_id TEXT NOT NULL,
  version_range TEXT NOT NULL,
  optional BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(release_id, dependency_module_id)
);

CREATE TABLE IF NOT EXISTS greenfield_module_permissions (
  permission_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  reason TEXT NOT NULL,
  risk TEXT NOT NULL CHECK (risk IN ('low','medium','high','restricted')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(release_id, permission)
);

CREATE TABLE IF NOT EXISTS greenfield_module_permission_reviews (
  review_id TEXT PRIMARY KEY,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id),
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  granted_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  denied_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  high_risk_increase BOOLEAN NOT NULL DEFAULT FALSE,
  idempotency_key TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS greenfield_module_install_plans (
  plan_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id),
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE SET NULL,
  requested_version TEXT NOT NULL,
  resolved_dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  permission_decision JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('created','queued','claimed','completed','failed','cancelled')),
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS greenfield_module_contributions (
  contribution_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  contribution_type TEXT NOT NULL CHECK (contribution_type IN ('route','profileTab','boardSurface','setting','schema','tool','function','widget','plugin','connector','job','event')),
  contribution_key TEXT NOT NULL,
  manifest JSONB NOT NULL,
  execution_required BOOLEAN NOT NULL DEFAULT FALSE,
  registration_status TEXT NOT NULL DEFAULT 'declared' CHECK (registration_status IN ('declared','registered','disabled','quarantined','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(release_id, contribution_key)
);
CREATE INDEX IF NOT EXISTS greenfield_module_contributions_module_idx ON greenfield_module_contributions(module_id, contribution_type);

CREATE TABLE IF NOT EXISTS greenfield_module_license_evidence (
  evidence_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('rootLicense','packageMetadata','readmeDeclaration','registryMetadata','maintainerStatement','founderOverride','firstPartyPolicy')),
  summary TEXT NOT NULL,
  source_path TEXT,
  checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS greenfield_module_release_integrity (
  integrity_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL UNIQUE REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  manifest_sha256 TEXT NOT NULL,
  release_sha256 TEXT,
  schema_sha256 JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings_schema_sha256 TEXT,
  source_commit TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  mismatch_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS greenfield_module_release_signatures (
  signature_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  signature_key_id TEXT NOT NULL,
  signature TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'Ed25519',
  verified_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  UNIQUE(release_id, signature_key_id)
);

CREATE TABLE IF NOT EXISTS greenfield_module_installation_settings (
  settings_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL UNIQUE REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('account','installation','team')),
  schema_version INTEGER NOT NULL DEFAULT 1,
  values JSONB NOT NULL DEFAULT '{}'::jsonb,
  secret_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT REFERENCES greenfield_accounts(account_id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS greenfield_module_settings_versions (
  settings_version_id TEXT PRIMARY KEY,
  settings_id TEXT NOT NULL REFERENCES greenfield_module_installation_settings(settings_id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  values JSONB NOT NULL,
  secret_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
  changed_by TEXT REFERENCES greenfield_accounts(account_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(settings_id, version)
);

CREATE TABLE IF NOT EXISTS greenfield_module_sync_sources (
  sync_source_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('github')),
  repository TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, repository)
);

CREATE TABLE IF NOT EXISTS greenfield_module_sync_runs (
  sync_run_id TEXT PRIMARY KEY,
  sync_source_id TEXT REFERENCES greenfield_module_sync_sources(sync_source_id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed','cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS greenfield_module_sync_failures (
  sync_failure_id TEXT PRIMARY KEY,
  sync_run_id TEXT REFERENCES greenfield_module_sync_runs(sync_run_id) ON DELETE CASCADE,
  repository TEXT,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  retryable BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS greenfield_module_quarantines (
  quarantine_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  policy_action TEXT NOT NULL CHECK (policy_action IN ('warn','disableExecutableContributions','block')),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lifted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS greenfield_module_revocations (
  revocation_id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('release','module','publisher','signingKey')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scope, target_id)
);

INSERT INTO greenfield_publishers (publisher_id, display_name, website, status, trust_level, verified_at)
VALUES ('modula', 'Modula', 'https://modula.digital', 'verified', 'firstParty', NOW())
ON CONFLICT (publisher_id) DO UPDATE SET status='verified', trust_level='firstParty', updated_at=NOW(), verified_at=COALESCE(greenfield_publishers.verified_at, NOW());

INSERT INTO greenfield_publisher_namespaces (namespace, publisher_id, verification_method, verification_evidence, verified_at)
VALUES
  ('digital.modula', 'modula', 'firstPartyPolicy', '{"policy":"Modula first-party namespace"}', NOW()),
  ('digital.greenfield', 'modula', 'firstPartyPolicy', '{"policy":"Greenfield first-party namespace"}', NOW()),
  ('digital.dimon', 'modula', 'firstPartyPolicy', '{"policy":"DIMON reserved inactive namespace"}', NOW())
ON CONFLICT (namespace) DO UPDATE SET publisher_id='modula', verified_at=COALESCE(greenfield_publisher_namespaces.verified_at, NOW()), revoked_at=NULL;

INSERT INTO greenfield_extension_catalogue (extension_id, slug, kind, name, description, version, publisher, trust, catalogue_status, executable, manifest)
VALUES
  ('digital.modula.tasks', 'digital.modula.tasks', 'module', 'Tasks', 'Planned first-party module placeholder', '0.0.0', 'Modula', 'firstParty', 'unavailable', FALSE, '{"moduleId":"digital.modula.tasks","state":"planned","notInstallable":true,"unavailable":true}'),
  ('digital.modula.crm', 'digital.modula.crm', 'module', 'CRM', 'Planned first-party module placeholder', '0.0.0', 'Modula', 'firstParty', 'unavailable', FALSE, '{"moduleId":"digital.modula.crm","state":"planned","notInstallable":true,"unavailable":true}'),
  ('digital.modula.gaia-atlas', 'digital.modula.gaia-atlas', 'module', 'GAIA Atlas', 'Planned first-party module placeholder', '0.0.0', 'Modula', 'firstParty', 'unavailable', FALSE, '{"moduleId":"digital.modula.gaia-atlas","state":"planned","notInstallable":true,"unavailable":true}'),
  ('digital.dimon.core', 'digital.dimon.core', 'module', 'DIMON Core', 'Reserved inactive DIMON capability namespace', '0.0.0', 'Modula', 'firstParty', 'inactive', FALSE, '{"moduleId":"digital.dimon.core","classification":"firstPartySystem","inactive":true,"notInstallable":true,"capabilityNamespaces":["dimon:account","dimon:transaction","dimon:ledger"],"noBalances":true,"noWallets":true,"noTransactions":true}')
ON CONFLICT (slug) DO UPDATE SET catalogue_status=EXCLUDED.catalogue_status, manifest=EXCLUDED.manifest, updated_at=NOW();

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO modula_api, modula_worker;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','009') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
