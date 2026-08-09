# Transactional Email

Phase 7H separates mailbox hosting from application delivery.

Mailbox hosting remains an infrastructure concern under Hestia/Exim/Dovecot for addresses such as `hello@modula.digital`, `support@modula.digital`, `security@modula.digital`, and `no-reply@modula.digital`.

Transactional delivery is owned by Greenfield:

1. API route or service creates a short-lived token where needed.
2. `MailService` renders a fixed Modula template.
3. `greenfield_mail_jobs` persists the rendered subject, text body, HTML body, safe recipient metadata, and retry state.
4. `background_jobs` receives a `mail.deliver` job.
5. `services/greenfield-worker` sends through the configured authenticated SMTP relay.
6. Worker updates the mail job to `sent`, `retrying`, or `dead-letter`.

## Files

- `services/greenfield-api/src/mail/contract.ts`
- `services/greenfield-api/src/mail/templates.ts`
- `services/greenfield-api/src/mail/service.ts`
- `services/greenfield-worker/src/mail/transport.ts`
- `services/greenfield-worker/src/mail/handler.ts`
- `services/greenfield-api/migrations/029_phase7h_mail.sql`

## API Environment

- `MODULA_PUBLIC_WEB_URL`: public app URL used in email links. Production default is `https://modula.digital`.
- `MODULA_SUPPORT_EMAIL`: support contact shown in templates. Default is `support@modula.digital`.

The API does not connect to SMTP.

## Worker Environment

- `MODULA_MAIL_TRANSPORT`: `disabled`, `log`, or `smtp`.
- `MODULA_MAIL_REQUIRED`: set `true` for alpha/preview if `MODULA_ENVIRONMENT` is not `production`.
- `MODULA_MAIL_FROM`: sender, for example `Modula <no-reply@modula.digital>`.
- `MODULA_SMTP_HOST`
- `MODULA_SMTP_PORT`
- `MODULA_SMTP_USER`
- `MODULA_SMTP_PASSWORD`
- `MODULA_SMTP_SECURE`
- `MODULA_SMTP_REQUIRE_TLS`
- `MODULA_SMTP_TLS_REJECT_UNAUTHORIZED`: defaults to `true`; set `false` only for a deliberately private relay whose certificate chain is controlled out of band.

Production defaults to SMTP and refuses to start without authenticated relay credentials.

## Implemented Templates

- `verification`
- `password-reset`
- `password-changed`
- `new-sign-in`
- `email-changed`
- `invite`
- `account-deletion`

Registration, verification resend, password reset request, password reset completion, and new sign-in are wired to the queue. Email-change, invite, and account-deletion helpers exist for the corresponding lifecycle services when those routes are implemented.

## Retry Model

Mail jobs use bounded retries:

- attempt 1: immediate
- attempt 2: short worker retry delay
- attempt 3: longer worker retry delay
- attempt 4: final attempt before dead letter

SMTP failures are classified as:

- `temporary`
- `permanent`
- `authentication`
- `rate-limit`
- `DNS`
- `TLS`
- `invalid-recipient`

Permanent authentication, invalid-recipient, and permanent SMTP failures do not retry indefinitely.

## Operator Visibility

Admin ops can inspect queue counts at:

`GET /v1/admin/ops/mail/summary`

The response contains counts for `queued`, `sending`, `sent`, `failed`, `retrying`, and `deadLetter`.
