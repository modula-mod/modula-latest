-- QA rollback only. Production recovery must restore a pre-migration backup and
-- the prior application image so that verified billing evidence is not discarded.

DROP TABLE IF EXISTS greenfield_premium_apple_notifications;
DROP TABLE IF EXISTS greenfield_premium_apple_transaction_events;
DROP TABLE IF EXISTS greenfield_premium_apple_transactions;
DROP TABLE IF EXISTS greenfield_premium_apple_accounts;
DROP TABLE IF EXISTS greenfield_premium_apple_products;

UPDATE greenfield_premium_memberships
SET subscription_status = 'expired'
WHERE subscription_status = 'grace';

ALTER TABLE greenfield_premium_memberships
  DROP CONSTRAINT greenfield_premium_memberships_subscription_status_check,
  ADD CONSTRAINT greenfield_premium_memberships_subscription_status_check
    CHECK (subscription_status IN ('active', 'expired', 'revoked', 'downgraded'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM greenfield_premium_membership_events
    WHERE event_type IN ('purchased', 'restored', 'upgraded', 'grace_started', 'grace_ended')
  ) THEN
    RAISE EXCEPTION '088 rollback refused: verified Premium audit events require backup restore';
  END IF;
END
$$;

ALTER TABLE greenfield_premium_membership_events
  DROP CONSTRAINT greenfield_premium_membership_events_event_type_check,
  ADD CONSTRAINT greenfield_premium_membership_events_event_type_check
    CHECK (event_type IN ('assigned', 'renewed', 'expired', 'revoked', 'downgraded', 'badge_visibility_changed'));

UPDATE greenfield_premium_catalogue_versions
SET metadata = metadata - 'pricingStatus' - 'purchaseStatus'
  || '{"pricingStatus":"provisional","purchaseStatus":"disabled"}'::jsonb
WHERE catalogue_version = 1;

UPDATE greenfield_premium_tiers
SET metadata = metadata - 'displayPrice' - 'priceAuthority'
WHERE catalogue_version = 1;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '087')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
