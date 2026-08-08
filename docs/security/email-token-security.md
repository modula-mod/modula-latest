# Email Token Security

Phase 7H verification and recovery tokens use short-lived opaque random values.

## Rules

- Tokens are generated with `randomBytes(32).toString('base64url')`.
- Database storage uses SHA-256 token hashes.
- Public verification and reset responses never reveal account existence in production.
- Verification and reset tokens are single-use.
- Verification resend invalidates prior unconsumed verification tokens for that account.
- Password reset completion revokes active sessions for the account.
- Verification/reset URLs must not be written to logs.

## Persistence

The mail queue stores rendered email content so worker retries can survive process restarts. Logs redact token-like fields and the worker sanitizes SMTP failure messages before persisting them.

Mail job rows store:

- recipient address for actual delivery
- recipient hash
- safe masked recipient
- recipient domain
- template ID
- retry status
- provider message ID
- failure category
- correlation ID

Do not expose `greenfield_mail_jobs` to normal users. Operator views must show safe recipient metadata, not full token URLs.

## Link Routes

- Email verification: `/verify-email?email=<email>&token=<token>`
- Password reset: `/reset-password?token=<token>`

These routes are app routes on `MODULA_PUBLIC_WEB_URL`.

## Prohibited Content

Transactional email templates must not include:

- passwords
- access tokens
- refresh tokens
- private post/comment/note content
- hidden account metadata
- AI input
- provider secrets

Normal route handlers must not supply arbitrary HTML.
