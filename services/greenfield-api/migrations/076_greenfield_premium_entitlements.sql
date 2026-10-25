-- VPS-CONSOLIDATION-01: server-authoritative Premium and identity verification.
-- Premium is account-scoped. Verification is independent and cannot be purchased.
-- Payment processing and production document collection are intentionally absent.

CREATE TABLE greenfield_premium_catalogue_versions (
  catalogue_version INTEGER PRIMARY KEY CHECK (catalogue_version > 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'retired')),
  effective_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX greenfield_premium_one_active_catalogue_idx
  ON greenfield_premium_catalogue_versions(status) WHERE status = 'active';

CREATE TABLE greenfield_premium_tiers (
  catalogue_version INTEGER NOT NULL REFERENCES greenfield_premium_catalogue_versions(catalogue_version),
  tier_id TEXT NOT NULL CHECK (tier_id IN ('core', 'plus', 'horizon', 'horizon_plus', 'studio')),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  rank INTEGER NOT NULL CHECK (rank BETWEEN 0 AND 100),
  paid BOOLEAN NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (catalogue_version, tier_id),
  UNIQUE (catalogue_version, rank)
);

CREATE TABLE greenfield_premium_capabilities (
  catalogue_version INTEGER NOT NULL REFERENCES greenfield_premium_catalogue_versions(catalogue_version),
  capability_id TEXT NOT NULL CHECK (capability_id ~ '^[a-z][a-z0-9_]{2,79}$'),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  minimum_rank INTEGER NOT NULL CHECK (minimum_rank BETWEEN 0 AND 100),
  availability_mode TEXT NOT NULL CHECK (availability_mode IN ('existing_free', 'qa_only', 'future_disabled')),
  value_by_tier JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (catalogue_version, capability_id)
);

CREATE TABLE greenfield_premium_memberships (
  account_id TEXT PRIMARY KEY REFERENCES greenfield_accounts(account_id),
  catalogue_version INTEGER NOT NULL,
  tier_id TEXT NOT NULL,
  subscription_status TEXT NOT NULL CHECK (subscription_status IN ('active', 'expired', 'revoked', 'downgraded')),
  entitlement_source TEXT NOT NULL CHECK (entitlement_source IN ('qa_fixture', 'apple_verified', 'migration', 'promotion')),
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  membership_since TIMESTAMPTZ,
  revision INTEGER NOT NULL CHECK (revision > 0),
  provider_reference_hash TEXT CHECK (provider_reference_hash IS NULL OR char_length(provider_reference_hash) = 64),
  audit_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (catalogue_version, tier_id) REFERENCES greenfield_premium_tiers(catalogue_version, tier_id),
  CHECK (expires_at IS NULL OR expires_at > effective_at)
);

CREATE TABLE greenfield_premium_preferences (
  account_id TEXT PRIMARY KEY REFERENCES greenfield_accounts(account_id),
  badge_visible BOOLEAN NOT NULL DEFAULT TRUE,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_by_actor_id TEXT NOT NULL REFERENCES actors(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only membership history. Future verified billing handlers can use the
-- idempotency key without changing the current public API or trusting a client.
CREATE TABLE greenfield_premium_membership_events (
  event_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  event_type TEXT NOT NULL CHECK (event_type IN ('assigned', 'renewed', 'expired', 'revoked', 'downgraded', 'badge_visibility_changed')),
  previous_tier_id TEXT,
  tier_id TEXT NOT NULL,
  previous_status TEXT,
  subscription_status TEXT NOT NULL,
  source TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 8 AND 200),
  actor_id TEXT REFERENCES actors(id),
  audit_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX greenfield_premium_membership_events_account_idx
  ON greenfield_premium_membership_events(account_id, occurred_at DESC);

CREATE TABLE greenfield_verification_applications (
  application_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  requested_type TEXT NOT NULL CHECK (requested_type IN ('person', 'notable_person', 'organization', 'public_body', 'official_module_developer')),
  state TEXT NOT NULL CHECK (state IN ('pending', 'under_review', 'verified', 'paused', 'denied', 'revoked')),
  statement TEXT CHECK (statement IS NULL OR char_length(statement) <= 1000),
  submitted_by_actor_id TEXT NOT NULL REFERENCES actors(id),
  reviewer_actor_id TEXT REFERENCES actors(id),
  review_reason TEXT CHECK (review_reason IS NULL OR char_length(review_reason) <= 1000),
  reverification_due_at TIMESTAMPTZ,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX greenfield_verification_one_open_application_idx
  ON greenfield_verification_applications(account_id)
  WHERE state IN ('pending', 'under_review', 'verified', 'paused');

CREATE TABLE greenfield_verification_statuses (
  account_id TEXT PRIMARY KEY REFERENCES greenfield_accounts(account_id),
  state TEXT NOT NULL CHECK (state IN ('unverified', 'pending', 'under_review', 'verified', 'paused', 'denied', 'revoked')),
  verification_type TEXT CHECK (verification_type IS NULL OR verification_type IN ('person', 'notable_person', 'organization', 'public_body', 'official_module_developer')),
  active_application_id TEXT REFERENCES greenfield_verification_applications(application_id),
  effective_at TIMESTAMPTZ NOT NULL,
  reverification_due_at TIMESTAMPTZ,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((state = 'verified' AND verification_type IS NOT NULL) OR state <> 'verified')
);

CREATE TABLE greenfield_verification_appeals (
  appeal_id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES greenfield_verification_applications(application_id),
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  state TEXT NOT NULL CHECK (state IN ('pending', 'under_review', 'accepted', 'denied')),
  statement TEXT NOT NULL CHECK (char_length(statement) BETWEEN 1 AND 1000),
  submitted_by_actor_id TEXT NOT NULL REFERENCES actors(id),
  reviewer_actor_id TEXT REFERENCES actors(id),
  review_reason TEXT CHECK (review_reason IS NULL OR char_length(review_reason) <= 1000),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX greenfield_verification_one_open_appeal_idx
  ON greenfield_verification_appeals(application_id)
  WHERE state IN ('pending', 'under_review');

-- This is the immutable verification audit trail. Evidence is metadata-only in
-- this phase: no identity document or biometric columns exist.
CREATE TABLE greenfield_verification_events (
  event_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  application_id TEXT REFERENCES greenfield_verification_applications(application_id),
  appeal_id TEXT REFERENCES greenfield_verification_appeals(appeal_id),
  event_type TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 1000),
  audit_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX greenfield_verification_events_account_idx
  ON greenfield_verification_events(account_id, occurred_at DESC);

INSERT INTO greenfield_premium_catalogue_versions (catalogue_version, status, effective_at, metadata)
VALUES (1, 'active', NOW(), '{"pricingStatus":"provisional","purchaseStatus":"disabled","limitsStatus":"not_enforced"}'::jsonb);

INSERT INTO greenfield_premium_tiers (catalogue_version, tier_id, display_name, rank, paid, metadata) VALUES
  (1, 'core', 'Core', 0, FALSE, '{"price":null}'::jsonb),
  (1, 'plus', 'Plus', 10, TRUE, '{"price":null}'::jsonb),
  (1, 'horizon', 'Horizon', 20, TRUE, '{"price":null,"featured":true}'::jsonb),
  (1, 'horizon_plus', 'Horizon Plus', 30, TRUE, '{"price":null}'::jsonb),
  (1, 'studio', 'Studio', 40, TRUE, '{"price":null}'::jsonb);

INSERT INTO greenfield_premium_capabilities (catalogue_version, capability_id, display_name, minimum_rank, availability_mode, value_by_tier, metadata) VALUES
  (1, 'installed_module_allowance', 'Installed module allowance', 0, 'existing_free', '{}'::jsonb, '{"enforcement":"disabled"}'::jsonb),
  (1, 'storage_quota', 'Storage quota', 0, 'existing_free', '{}'::jsonb, '{"enforcement":"disabled"}'::jsonb),
  (1, 'in_mail_allowance', 'In-Mail allowance', 0, 'existing_free', '{}'::jsonb, '{"enforcement":"disabled"}'::jsonb),
  (1, 'profile_analytics', 'Profile analytics', 10, 'qa_only', '{}'::jsonb, '{}'::jsonb),
  (1, 'scheduled_posting', 'Scheduled posting', 10, 'qa_only', '{}'::jsonb, '{}'::jsonb),
  (1, 'premium_appearance', 'Premium appearance features', 10, 'qa_only', '{}'::jsonb, '{}'::jsonb),
  (1, 'premium_profile_plate', 'Premium profile plate', 20, 'qa_only', '{}'::jsonb, '{}'::jsonb),
  (1, 'premium_qr_styles', 'Premium QR card styles', 20, 'qa_only', '{}'::jsonb, '{}'::jsonb),
  (1, 'eligible_new_moliboo_content', 'Eligible new Moliboo content', 30, 'qa_only', '{}'::jsonb, '{"startsAfterExistingRoster":115,"ownershipSurvivesDowngrade":true}'::jsonb),
  (1, 'creator_business', 'Creator and business functionality', 30, 'qa_only', '{}'::jsonb, '{}'::jsonb),
  (1, 'team_membership', 'Team membership functionality', 40, 'qa_only', '{}'::jsonb, '{}'::jsonb),
  (1, 'cloud_ai', 'Future cloud AI features', 20, 'future_disabled', '{}'::jsonb, '{"enforcement":"disabled"}'::jsonb);

GRANT SELECT ON greenfield_premium_catalogue_versions, greenfield_premium_tiers, greenfield_premium_capabilities TO modula_api, modula_worker, modula_backup;
GRANT SELECT, INSERT, UPDATE ON greenfield_premium_memberships, greenfield_premium_preferences, greenfield_verification_applications, greenfield_verification_statuses, greenfield_verification_appeals TO modula_api;
GRANT SELECT, INSERT ON greenfield_premium_membership_events, greenfield_verification_events TO modula_api;
GRANT SELECT ON greenfield_premium_memberships, greenfield_premium_preferences, greenfield_premium_membership_events, greenfield_verification_applications, greenfield_verification_statuses, greenfield_verification_appeals, greenfield_verification_events TO modula_worker, modula_backup;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '076')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
