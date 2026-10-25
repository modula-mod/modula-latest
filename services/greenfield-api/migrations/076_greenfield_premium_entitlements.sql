-- Modula Premium: tiers, App Store entitlements and the separate verification mark.
-- Additive only: new tables, no changes to existing tables.
-- Downgrade, expiry, refund and revocation only change gating. Nothing here
-- references outfits, ownership or character state, and no row is ever deleted
-- by a billing event.
CREATE TABLE greenfield_premium_tiers (
  tier_id TEXT PRIMARY KEY CHECK (tier_id IN ('core', 'plus', 'horizon', 'horizon_plus', 'studio')),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  rank INTEGER NOT NULL UNIQUE CHECK (rank BETWEEN 0 AND 100),
  paid BOOLEAN NOT NULL
);
INSERT INTO greenfield_premium_tiers (tier_id, display_name, rank, paid) VALUES
  ('core', 'Modula Core', 0, FALSE),
  ('plus', 'Modula Plus', 10, TRUE),
  ('horizon', 'Modula Horizon', 20, TRUE),
  ('horizon_plus', 'Modula Horizon Plus', 30, TRUE),
  ('studio', 'Modula Studio', 40, TRUE);

-- App Store product identifiers mapped to a tier. Unknown products are rejected.
CREATE TABLE greenfield_premium_products (
  product_id TEXT PRIMARY KEY CHECK (char_length(product_id) BETWEEN 1 AND 200),
  tier_id TEXT NOT NULL REFERENCES greenfield_premium_tiers(tier_id),
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'yearly'))
);
INSERT INTO greenfield_premium_products (product_id, tier_id, billing_period) VALUES
  ('digital.modula.premium.plus.monthly', 'plus', 'monthly'),
  ('digital.modula.premium.plus.yearly', 'plus', 'yearly'),
  ('digital.modula.premium.horizon.monthly', 'horizon', 'monthly'),
  ('digital.modula.premium.horizon.yearly', 'horizon', 'yearly'),
  ('digital.modula.premium.horizon_plus.monthly', 'horizon_plus', 'monthly'),
  ('digital.modula.premium.horizon_plus.yearly', 'horizon_plus', 'yearly'),
  ('digital.modula.premium.studio.monthly', 'studio', 'monthly'),
  ('digital.modula.premium.studio.yearly', 'studio', 'yearly');

-- One row per actor: the StoreKit appAccountToken and the never-reset tenure date.
CREATE TABLE greenfield_premium_members (
  actor_id TEXT PRIMARY KEY REFERENCES actors(id),
  app_account_token UUID NOT NULL UNIQUE,
  member_since TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per App Store subscription (original transaction). Never deleted.
CREATE TABLE greenfield_premium_entitlements (
  entitlement_id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  tier_id TEXT NOT NULL REFERENCES greenfield_premium_tiers(tier_id),
  source TEXT NOT NULL CHECK (source IN ('apple', 'admin')),
  environment TEXT NOT NULL CHECK (environment IN ('Sandbox', 'Production', 'qa')),
  product_id TEXT REFERENCES greenfield_premium_products(product_id),
  original_transaction_id TEXT UNIQUE CHECK (original_transaction_id IS NULL OR char_length(original_transaction_id) BETWEEN 1 AND 64),
  latest_transaction_id TEXT CHECK (latest_transaction_id IS NULL OR char_length(latest_transaction_id) BETWEEN 1 AND 64),
  status TEXT NOT NULL CHECK (status IN ('active', 'grace', 'billing_retry', 'expired', 'revoked')),
  auto_renew BOOLEAN,
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  grace_expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT CHECK (revocation_reason IS NULL OR char_length(revocation_reason) <= 80),
  last_signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source <> 'apple' OR original_transaction_id IS NOT NULL)
);
CREATE INDEX greenfield_premium_entitlements_actor_idx ON greenfield_premium_entitlements(actor_id, status);

-- Append-only audit trail and webhook idempotency.
CREATE TABLE greenfield_premium_events (
  event_id TEXT PRIMARY KEY,
  entitlement_id TEXT REFERENCES greenfield_premium_entitlements(entitlement_id),
  actor_id TEXT REFERENCES actors(id),
  source TEXT NOT NULL CHECK (source IN ('client_transaction', 'apple_notification', 'admin')),
  notification_uuid TEXT UNIQUE,
  notification_type TEXT,
  notification_subtype TEXT,
  previous_status TEXT,
  status TEXT,
  payload_sha256 TEXT NOT NULL CHECK (char_length(payload_sha256) = 64),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_premium_events_entitlement_idx ON greenfield_premium_events(entitlement_id, occurred_at DESC);

-- Verification is a trust mark, kept apart from billing. No billing code path
-- writes this table; it can never be bought.
CREATE TABLE greenfield_verifications (
  actor_id TEXT PRIMARY KEY REFERENCES actors(id),
  verified_type TEXT NOT NULL CHECK (verified_type IN ('person', 'organisation', 'official')),
  state TEXT NOT NULL CHECK (state IN ('verified', 'revoked')),
  verified_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 280),
  set_by_actor_id TEXT NOT NULL REFERENCES actors(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON greenfield_premium_tiers, greenfield_premium_products TO modula_api, modula_worker, modula_backup;
GRANT SELECT, INSERT, UPDATE ON greenfield_premium_members, greenfield_premium_entitlements, greenfield_verifications TO modula_api, modula_worker;
GRANT SELECT, INSERT ON greenfield_premium_events TO modula_api, modula_worker;
GRANT SELECT ON greenfield_premium_members, greenfield_premium_entitlements, greenfield_premium_events, greenfield_verifications TO modula_backup;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '076')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
