# Modula Authentication Security

Date: 2026-08-11

## Security Posture

The Phase 7I-F5 source foundation moves Greenfield toward explicit, auditable authentication state.

Security-sensitive state is represented in separate tables instead of one large JSON blob:

| Table | Purpose |
| --- | --- |
| `greenfield_authentication_methods` | method registry and strength/state metadata |
| `greenfield_auth_challenges` | short-lived challenge records |
| `greenfield_auth_challenge_attempts` | attempt/replay/failure evidence |
| `greenfield_totp_credentials` | future encrypted TOTP secret records |
| `greenfield_recovery_code_sets` / `greenfield_recovery_codes` | future hash-only recovery-code sets |
| `greenfield_external_identities` | Apple/OIDC linking model |
| `greenfield_security_events` | account security activity |

## Implemented Controls

- Passwords remain Argon2id-hashed in `greenfield_password_credentials`.
- Password login returns `INVALID_CREDENTIALS` for invalid email/password combinations.
- Suspended accounts only return `ACCOUNT_SUSPENDED` after the password is valid.
- Sessions store `recent_authentication_at`, `authentication_strength`, and `authentication_method_id`.
- Step-up policy is server-side in `src/auth/step-up/policy.ts`.
- Challenge codes are stored as digests and are single-use.
- Replayed challenges are classified as `CHALLENGE_REPLAYED`.
- Security-event metadata is sanitized for secret-looking keys.

## Remaining Security Work

Blocked until later F5 slices:

- real passkey/WebAuthn verification;
- TOTP secret encryption and enrollment confirmation;
- recovery-code generation and hash-only storage;
- async email OTP delivery and endpoint rate limits;
- account deletion step-up;
- external Apple identity verification and linking;
- production DB isolated restore from a fresh dump before live migration.

OTP remains a complement to passkeys, not a passkey replacement for high-value authentication.
