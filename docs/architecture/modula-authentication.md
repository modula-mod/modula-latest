# Modula Authentication Architecture

Date: 2026-08-11
Scope: Phase 7I-F5 source foundation in `/root/modula-latest`.

## Authority Model

Greenfield remains the sovereign account authority.

External mechanisms authenticate into a Greenfield account. They do not create separate user systems.

Current hierarchy:

| Method | Role | Current source state |
| --- | --- | --- |
| Passkey | strongest/default modern path | table model extended; WebAuthn registration/assertion not wired yet |
| Password | supported fallback | wired through explicit auth-method registry and existing Argon2id credential table |
| Email OTP | registration/contact verification and future passwordless sign-in | method registry and challenge engine foundation added; passwordless route/mail-code flow not wired yet |
| TOTP | MFA authenticator apps | table model added; enrollment/QR/verification not wired yet |
| Recovery codes | account recovery | table model added; generation/use endpoints not wired yet |
| Sign in with Apple | optional linked authentication method | external identity table model added; AuthenticationServices/server verification not wired yet |
| OIDC | future trusted providers | provider-neutral table model added; no Google/social primary login enabled |

## Source Boundary

The first F5 slice adds a cohesive backend domain under:

```text
services/greenfield-api/src/auth/
```

Important files:

| Path | Responsibility |
| --- | --- |
| `src/auth/credentials/service.ts` | explicit authentication method registry |
| `src/auth/challenges/service.ts` | random, short-lived, single-use challenge engine |
| `src/auth/security-events/service.ts` | account security activity writer |
| `src/auth/step-up/policy.ts` | server-owned sensitive-action step-up policy |
| `src/auth/errors.ts` | canonical auth-domain errors |
| `src/sessions/service.ts` | canonical Greenfield sessions with recent-auth context |

## Implemented In This Slice

- Migration `031_phase7i_f5_auth_domain` adds explicit auth-method, challenge, TOTP, recovery-code, external-identity, security-event, and rate-limit tables.
- Existing password credentials are backfilled into `greenfield_authentication_methods`.
- Existing verified email identities are backfilled into `email_otp` methods.
- Existing passkeys are backfilled into passkey auth-method rows and passkey metadata columns.
- Registration creates password and pending email-code auth methods.
- Email verification activates the email-code method and records security activity.
- Password login verifies the existing password hash, resolves the password auth method, issues the normal Greenfield session, stores recent-auth context, and records `sign_in`.
- Password change and password reset refresh password-method metadata and record security events.
- Challenge verification is single-use and rejects replay.

## Not Implemented Yet

- WebAuthn/passkey options, attestation/assertion verification, and native AuthenticationServices flows.
- Email OTP login route, persisted OTP mail job, resend timer policy, and UI.
- TOTP enrollment/QR/manual secret verification.
- Recovery-code generation/use/regeneration endpoints.
- Sign in with Apple server verification and account linking.
- Account deletion step-up flow.
- Production DB migration application.

No production cutover or public auth PASS is implied by this document.
