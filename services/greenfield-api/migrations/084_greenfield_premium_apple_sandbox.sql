-- GREENFIELD-FEATURE-REALITY-01 / PR-07: verified Apple sandbox Premium state.
-- This migration does not enable production billing and deliberately seeds no
-- App Store product identifiers. QA operators must configure identifiers that
-- have been confirmed in App Store Connect before purchase verification can run.

ALTER TABLE greenfield_premium_memberships
  DROP CONSTRAINT greenfield_premium_memberships_subscription_status_check,
  ADD CONSTRAINT greenfield_premium_memberships_subscription_status_check
    CHECK (subscription_status IN ('active', 'grace', 'expired', 'revoked', 'downgraded'));

ALTER TABLE greenfield_premium_membership_events
  DROP CONSTRAINT greenfield_premium_membership_events_event_type_check,
  ADD CONSTRAINT greenfield_premium_membership_events_event_type_check
    CHECK (event_type IN (
      'assigned', 'purchased', 'restored', 'renewed', 'upgraded', 'downgraded',
      'grace_started', 'grace_ended', 'expired', 'revoked', 'badge_visibility_changed'
    ));

CREATE TABLE greenfield_premium_apple_products (
  product_id TEXT PRIMARY KEY CHECK (char_length(product_id) BETWEEN 3 AND 160),
  catalogue_version INTEGER NOT NULL,
  tier_id TEXT NOT NULL CHECK (tier_id IN ('plus', 'horizon', 'horizon_plus', 'studio')),
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'annual')),
  environment TEXT NOT NULL DEFAULT 'Sandbox' CHECK (environment = 'Sandbox'),
  state TEXT NOT NULL CHECK (state IN ('active', 'disabled')),
  configured_by_actor_id TEXT NOT NULL REFERENCES actors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (catalogue_version, tier_id)
    REFERENCES greenfield_premium_tiers(catalogue_version, tier_id)
);

CREATE UNIQUE INDEX greenfield_premium_apple_one_active_product_idx
  ON greenfield_premium_apple_products(catalogue_version, tier_id, billing_period, environment)
  WHERE state = 'active';

CREATE TABLE greenfield_premium_apple_accounts (
  account_id TEXT PRIMARY KEY REFERENCES greenfield_accounts(account_id),
  app_account_token UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE greenfield_premium_apple_transactions (
  transaction_id TEXT PRIMARY KEY CHECK (char_length(transaction_id) BETWEEN 1 AND 160),
  original_transaction_id TEXT NOT NULL CHECK (char_length(original_transaction_id) BETWEEN 1 AND 160),
  web_order_line_item_id TEXT CHECK (web_order_line_item_id IS NULL OR char_length(web_order_line_item_id) BETWEEN 1 AND 160),
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  app_account_token UUID NOT NULL REFERENCES greenfield_premium_apple_accounts(app_account_token),
  product_id TEXT NOT NULL REFERENCES greenfield_premium_apple_products(product_id),
  purchase_at TIMESTAMPTZ NOT NULL,
  original_purchase_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  grace_expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  environment TEXT NOT NULL CHECK (environment = 'Sandbox'),
  ownership_type TEXT NOT NULL CHECK (ownership_type = 'PURCHASED'),
  is_upgraded BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL CHECK (status IN ('active', 'grace', 'expired', 'revoked')),
  latest_signed_at TIMESTAMPTZ NOT NULL,
  evidence_sha256 TEXT NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at IS NULL OR expires_at > original_purchase_at),
  CHECK (grace_expires_at IS NULL OR expires_at IS NULL OR grace_expires_at >= expires_at),
  CHECK (revoked_at IS NULL OR revoked_at >= original_purchase_at)
);

CREATE INDEX greenfield_premium_apple_transactions_account_idx
  ON greenfield_premium_apple_transactions(account_id, latest_signed_at DESC);
CREATE INDEX greenfield_premium_apple_transactions_original_idx
  ON greenfield_premium_apple_transactions(original_transaction_id, latest_signed_at DESC);

CREATE TABLE greenfield_premium_apple_transaction_events (
  event_id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES greenfield_premium_apple_transactions(transaction_id),
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  source TEXT NOT NULL CHECK (source IN ('client', 'notification')),
  notification_uuid TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'grace', 'expired', 'revoked')),
  signed_at TIMESTAMPTZ NOT NULL,
  evidence_sha256 TEXT NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  reason_code TEXT NOT NULL CHECK (char_length(reason_code) BETWEEN 1 AND 120),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (transaction_id, evidence_sha256)
);

CREATE INDEX greenfield_premium_apple_transaction_events_account_idx
  ON greenfield_premium_apple_transaction_events(account_id, occurred_at DESC);

CREATE TABLE greenfield_premium_apple_notifications (
  notification_uuid TEXT PRIMARY KEY CHECK (char_length(notification_uuid) BETWEEN 1 AND 160),
  notification_type TEXT NOT NULL CHECK (char_length(notification_type) BETWEEN 1 AND 80),
  subtype TEXT CHECK (subtype IS NULL OR char_length(subtype) BETWEEN 1 AND 80),
  environment TEXT NOT NULL CHECK (environment = 'Sandbox'),
  signed_at TIMESTAMPTZ NOT NULL,
  evidence_sha256 TEXT NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  transaction_id TEXT REFERENCES greenfield_premium_apple_transactions(transaction_id),
  state TEXT NOT NULL CHECK (state IN ('processed', 'ignored', 'unbound')),
  reason_code TEXT NOT NULL CHECK (char_length(reason_code) BETWEEN 1 AND 120),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

UPDATE greenfield_premium_catalogue_versions
SET metadata = metadata || '{"pricingStatus":"supplied_display_only","purchaseStatus":"sandbox_configuration_required"}'::jsonb
WHERE catalogue_version = 1;

UPDATE greenfield_premium_tiers
SET metadata = metadata || CASE tier_id
  WHEN 'core' THEN '{"displayPrice":"Free","priceAuthority":"mission_supplied_display_only"}'::jsonb
  WHEN 'plus' THEN '{"displayPrice":"£3.99","priceAuthority":"mission_supplied_display_only"}'::jsonb
  WHEN 'horizon' THEN '{"displayPrice":"£8.99","priceAuthority":"mission_supplied_display_only"}'::jsonb
  WHEN 'horizon_plus' THEN '{"displayPrice":"£14.99","priceAuthority":"mission_supplied_display_only"}'::jsonb
  WHEN 'studio' THEN '{"displayPrice":"From £29.99","priceAuthority":"mission_supplied_display_only"}'::jsonb
END
WHERE catalogue_version = 1;

GRANT SELECT, INSERT, UPDATE ON
  greenfield_premium_apple_products,
  greenfield_premium_apple_accounts,
  greenfield_premium_apple_transactions,
  greenfield_premium_apple_notifications
TO modula_api;
GRANT SELECT, INSERT ON greenfield_premium_apple_transaction_events TO modula_api;
GRANT SELECT ON
  greenfield_premium_apple_products,
  greenfield_premium_apple_accounts,
  greenfield_premium_apple_transactions,
  greenfield_premium_apple_transaction_events,
  greenfield_premium_apple_notifications
TO modula_worker, modula_backup;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '084')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
