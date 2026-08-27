-- Greenfield Backend V1: developer identity, ownership and release-control ledger.

CREATE TABLE greenfield_developer_profiles (
  account_id TEXT PRIMARY KEY REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  biography TEXT NOT NULL DEFAULT '',
  website TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE greenfield_developer_organisations (
  organisation_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z][a-z0-9-]{2,62}$'),
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','CLOSED')),
  created_by_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE greenfield_developer_organisation_memberships (
  membership_id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES greenfield_developer_organisations(organisation_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('OWNER','ADMIN','DEVELOPER','RELEASE_MANAGER','VIEWER')),
  state TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('INVITED','ACTIVE','SUSPENDED','REMOVED')),
  invited_by_account_id TEXT REFERENCES greenfield_accounts(account_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organisation_id, account_id)
);
CREATE INDEX greenfield_developer_memberships_account_idx ON greenfield_developer_organisation_memberships(account_id, state);

CREATE TABLE greenfield_publisher_owners (
  publisher_owner_id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL REFERENCES greenfield_publishers(publisher_id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('ACCOUNT','ORGANISATION')),
  account_id TEXT REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  organisation_id TEXT REFERENCES greenfield_developer_organisations(organisation_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((owner_type='ACCOUNT' AND account_id IS NOT NULL AND organisation_id IS NULL) OR
         (owner_type='ORGANISATION' AND organisation_id IS NOT NULL AND account_id IS NULL)),
  UNIQUE NULLS NOT DISTINCT(publisher_id, account_id, organisation_id)
);

CREATE TABLE greenfield_developer_agreements (
  agreement_id TEXT NOT NULL,
  version TEXT NOT NULL,
  document_hash TEXT NOT NULL CHECK (document_hash ~ '^[0-9a-f]{64}$'),
  effective_at TIMESTAMPTZ NOT NULL,
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(agreement_id, version)
);

CREATE TABLE greenfield_developer_agreement_acceptances (
  acceptance_id TEXT PRIMARY KEY,
  agreement_id TEXT NOT NULL,
  agreement_version TEXT NOT NULL,
  accepted_by_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  document_hash TEXT NOT NULL CHECK (document_hash ~ '^[0-9a-f]{64}$'),
  FOREIGN KEY(agreement_id, agreement_version) REFERENCES greenfield_developer_agreements(agreement_id, version),
  UNIQUE(agreement_id, agreement_version, accepted_by_account_id)
);

CREATE TABLE greenfield_developer_programme_memberships (
  programme_membership_id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  organisation_id TEXT REFERENCES greenfield_developer_organisations(organisation_id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('NOT_ENROLLED','PENDING','ACTIVE','PAST_DUE','SUSPENDED','TERMINATED')),
  state_reason TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((account_id IS NOT NULL)::integer + (organisation_id IS NOT NULL)::integer = 1),
  UNIQUE NULLS NOT DISTINCT(account_id, organisation_id)
);

CREATE TABLE greenfield_developer_products (
  product_id TEXT PRIMARY KEY CHECK (product_id ~ '^[a-z0-9]+([.-][a-z0-9]+)+$'),
  publisher_id TEXT NOT NULL REFERENCES greenfield_publishers(publisher_id),
  owner_account_id TEXT REFERENCES greenfield_accounts(account_id),
  owner_organisation_id TEXT REFERENCES greenfield_developer_organisations(organisation_id),
  extension_id TEXT REFERENCES greenfield_extensions(extension_id),
  kind TEXT NOT NULL CHECK (kind IN ('module','addon','plugin','function','tool','widget','connector','backend-service','backend-engine','game-module')),
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE','INTERNAL','UNLISTED','BETA','PUBLIC')),
  state TEXT NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT','ACTIVE','SUSPENDED','ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((owner_account_id IS NOT NULL)::integer + (owner_organisation_id IS NOT NULL)::integer = 1)
);
CREATE INDEX greenfield_developer_products_owner_account_idx ON greenfield_developer_products(owner_account_id, state);
CREATE INDEX greenfield_developer_products_owner_org_idx ON greenfield_developer_products(owner_organisation_id, state);

CREATE TABLE greenfield_developer_source_connections (
  source_connection_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES greenfield_developer_products(product_id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('github','gitlab','bitbucket','self-hosted-git')),
  repository TEXT NOT NULL,
  repository_id TEXT,
  default_branch TEXT NOT NULL DEFAULT 'main',
  credential_ref TEXT,
  state TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('PENDING','ACTIVE','REVOKED','ERROR')),
  created_by_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE(product_id, provider, repository)
);

CREATE TABLE greenfield_developer_builds (
  build_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES greenfield_developer_products(product_id) ON DELETE CASCADE,
  source_connection_id TEXT REFERENCES greenfield_developer_source_connections(source_connection_id),
  source_sha TEXT NOT NULL CHECK (source_sha ~ '^[0-9a-f]{40}$'),
  state TEXT NOT NULL CHECK (state IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED')),
  builder_identity TEXT NOT NULL,
  artifact_ref TEXT,
  artifact_sha256 TEXT CHECK (artifact_sha256 IS NULL OR artifact_sha256 ~ '^[0-9a-f]{64}$'),
  sbom_ref TEXT,
  provenance_ref TEXT,
  created_by_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);
CREATE INDEX greenfield_developer_builds_product_idx ON greenfield_developer_builds(product_id, created_at DESC);

CREATE TABLE greenfield_developer_releases (
  developer_release_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES greenfield_developer_products(product_id) ON DELETE CASCADE,
  build_id TEXT NOT NULL REFERENCES greenfield_developer_builds(build_id),
  module_release_id TEXT REFERENCES greenfield_module_releases(release_id),
  version TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('DEVELOPMENT','INTERNAL','ALPHA','BETA','RC','STABLE')),
  state TEXT NOT NULL CHECK (state IN ('DRAFT','CANDIDATE','QUARANTINED','RELEASED','REVOKED','SUPERSEDED')),
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, version, channel)
);

CREATE TABLE greenfield_developer_test_groups (
  test_group_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES greenfield_developer_products(product_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('OWNER','TEAM','INTERNAL','ALPHA','BETA','NAMED')),
  created_by_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, name)
);

CREATE TABLE greenfield_developer_test_group_members (
  test_group_id TEXT NOT NULL REFERENCES greenfield_developer_test_groups(test_group_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('INVITED','ACTIVE','REMOVED')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(test_group_id, account_id)
);

CREATE TABLE greenfield_developer_release_test_groups (
  developer_release_id TEXT NOT NULL REFERENCES greenfield_developer_releases(developer_release_id) ON DELETE CASCADE,
  test_group_id TEXT NOT NULL REFERENCES greenfield_developer_test_groups(test_group_id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(developer_release_id, test_group_id)
);

CREATE TABLE greenfield_developer_review_submissions (
  review_submission_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES greenfield_developer_products(product_id) ON DELETE CASCADE,
  developer_release_id TEXT REFERENCES greenfield_developer_releases(developer_release_id),
  state TEXT NOT NULL CHECK (state IN ('DRAFT','SUBMITTED','AUTOMATED_REVIEW','MANUAL_REVIEW','CHANGES_REQUIRED','APPROVED','REJECTED','PUBLISHED','SUSPENDED','REMOVED')),
  checks JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(checks)='object'),
  submitted_by_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  reviewer_account_id TEXT REFERENCES greenfield_accounts(account_id),
  decision_reason TEXT,
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_developer_reviews_queue_idx ON greenfield_developer_review_submissions(state, created_at);

GRANT SELECT, INSERT, UPDATE ON
  greenfield_developer_profiles, greenfield_developer_organisations, greenfield_developer_organisation_memberships,
  greenfield_publisher_owners, greenfield_developer_agreement_acceptances, greenfield_developer_programme_memberships,
  greenfield_developer_products, greenfield_developer_source_connections, greenfield_developer_builds,
  greenfield_developer_releases, greenfield_developer_test_groups, greenfield_developer_test_group_members,
  greenfield_developer_release_test_groups, greenfield_developer_review_submissions TO modula_api;
GRANT SELECT ON greenfield_developer_agreements TO modula_api;
GRANT SELECT ON
  greenfield_developer_profiles, greenfield_developer_organisations, greenfield_developer_organisation_memberships,
  greenfield_publisher_owners, greenfield_developer_agreements, greenfield_developer_agreement_acceptances,
  greenfield_developer_programme_memberships, greenfield_developer_products, greenfield_developer_source_connections,
  greenfield_developer_builds, greenfield_developer_releases, greenfield_developer_test_groups,
  greenfield_developer_test_group_members, greenfield_developer_release_test_groups,
  greenfield_developer_review_submissions TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '047')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
