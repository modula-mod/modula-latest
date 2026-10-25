DROP TABLE IF EXISTS greenfield_verifications;
DROP TABLE IF EXISTS greenfield_premium_events;
DROP TABLE IF EXISTS greenfield_premium_entitlements;
DROP TABLE IF EXISTS greenfield_premium_members;
DROP TABLE IF EXISTS greenfield_premium_products;
DROP TABLE IF EXISTS greenfield_premium_tiers;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '075')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
