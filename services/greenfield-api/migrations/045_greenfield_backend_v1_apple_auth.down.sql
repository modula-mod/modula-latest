DELETE FROM greenfield_auth_challenges
WHERE purpose IN ('apple_authentication', 'apple_linking');

ALTER TABLE greenfield_auth_challenges
  DROP CONSTRAINT IF EXISTS greenfield_auth_challenges_delivery_channel_check;

ALTER TABLE greenfield_auth_challenges
  ADD CONSTRAINT greenfield_auth_challenges_delivery_channel_check CHECK (
    delivery_channel IN ('email', 'authenticator', 'webauthn', 'recovery', 'internal')
  );

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
    'account_recovery'
  ));

UPDATE schema_metadata SET value='044', updated_at=NOW() WHERE key='schema_version';
