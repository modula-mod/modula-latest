DROP TABLE IF EXISTS greenfield_verification_events;
DROP TABLE IF EXISTS greenfield_verification_appeals;
DROP TABLE IF EXISTS greenfield_verification_statuses;
DROP TABLE IF EXISTS greenfield_verification_applications;
DROP TABLE IF EXISTS greenfield_premium_membership_events;
DROP TABLE IF EXISTS greenfield_premium_preferences;
DROP TABLE IF EXISTS greenfield_premium_memberships;
DROP TABLE IF EXISTS greenfield_premium_capabilities;
DROP TABLE IF EXISTS greenfield_premium_tiers;
DROP TABLE IF EXISTS greenfield_premium_catalogue_versions;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '075')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
