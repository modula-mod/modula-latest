-- Greenfield Backend V1: Sign in with Apple challenge purposes.
-- Apple identity/provider rows were deliberately reserved by migration 031;
-- this migration extends the shared one-time challenge ledger for live use.

ALTER TABLE greenfield_auth_challenges
  DROP CONSTRAINT IF EXISTS greenfield_auth_challenges_purpose_check;

ALTER TABLE greenfield_auth_challenges
  ADD CONSTRAINT greenfield_auth_challenges_purpose_check CHECK (purpose IN (
    'email_verification',
    'email_login',
    'password_reset',
    'email_change',
    'contact_email_change',
    'passkey_registration',
    'passkey_authentication',
    'totp_enrollment',
    'step_up',
    'account_recovery',
    'apple_authentication',
    'apple_linking'
  ));

ALTER TABLE greenfield_auth_challenges
  DROP CONSTRAINT IF EXISTS greenfield_auth_challenges_delivery_channel_check;

ALTER TABLE greenfield_auth_challenges
  ADD CONSTRAINT greenfield_auth_challenges_delivery_channel_check CHECK (
    delivery_channel IN ('email', 'authenticator', 'webauthn', 'recovery', 'internal', 'external')
  );

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '045')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
