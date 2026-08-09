# Phase 7I-D Mail Validation

Date: 2026-08-09

Mail relay code checkpoint: `3cc108d2413689ca4aa0ef37fab161811b3829d3`

The production images were rebuilt again after documentation commits. Use `docker inspect modula-production-greenfield-api-1 modula-production-greenfield-worker-1` to verify the current OCI revision on the host.

## Result

Local mail runtime: PASS

Greenfield transactional mail pipeline: PASS

Public DNS/external mail acceptance: BLOCKED

Reason: the host has no Cloudflare DNS edit token or Wrangler CLI, and public Cloudflare DNS still exposes stale mail records.

## Runtime Evidence

Production images at the mail-code validation run:

- `modula-greenfield-api:3cc108d2413689ca4aa0ef37fab161811b3829d3`
- `modula-greenfield-worker:3cc108d2413689ca4aa0ef37fab161811b3829d3`
- OCI revision: `3cc108d2413689ca4aa0ef37fab161811b3829d3`
- OCI created: `2026-08-09T00:54:11Z`

Container checks:

- API health: `/v1/health/live` returned `200`
- API ready: `/v1/health/ready` returned `200`
- `/v1/meta` reports production registration `{mode: "open", emailVerificationRequired: true}`
- API UID: `999`
- Worker UID: `999`
- Worker resolves `host.docker.internal` to `172.17.0.1`
- Worker TCP connect to host Exim port 25 succeeded

## Mailbox Routing

`exim -bt` routed all required production addresses through `virtual_mailboxes` and `virtual_delivery`:

- `hello@modula.digital`
- `support@modula.digital`
- `security@modula.digital`
- `privacy@modula.digital`
- `legal@modula.digital`
- `no-reply@modula.digital`

Maildir parent directories for those mailboxes are owned by `vmail:mail` and mode `700`.

## SMTP Auth And Relay

Plain SMTP EHLO on port 25 did not advertise AUTH.

STARTTLS SMTP EHLO advertised:

- `AUTH PLAIN LOGIN`

Authenticated local relay proof:

- `no-reply@modula.digital` authenticated over STARTTLS.
- Exim logged `P=esmtpsa`.
- Delivery to `hello@modula.digital` completed through `virtual_delivery`.

No open relay proof:

- Simulated external sender `198.51.100.10`
- `MAIL FROM:<attacker@example.net>`
- `RCPT TO:<victim@example.org>`
- Result: `550 Relay not permitted`

## Greenfield Mail Pipeline

Smoke account:

- recipient: `phase7id-smoke@modula.digital`
- register endpoint: `POST /v1/accounts/register`
- register HTTP: `201`
- production response did not include `verificationToken`

Mail job status after registration:

- `verification|sent|1`

The verification email was delivered to `/var/vmail/modula.digital/phase7id-smoke/new`.

Token handling:

- Verification token was parsed from the delivered MIME message without printing it.
- `POST /v1/accounts/verify-email` returned `200`.
- Replaying the verification token returned `401 UNAUTHENTICATED`.

Password recovery:

- `POST /v1/accounts/forgot-password` returned `200`.
- Password reset token was parsed from the delivered MIME message without printing it.
- `POST /v1/accounts/reset-password` returned `200`.
- Login with the reset password returned `200` with access and refresh tokens.
- Replaying the reset token returned `404 NOT_FOUND`.

Final mail job status for the smoke account:

- `verification:sent:1`
- `password-reset:sent:1`
- `password-changed:sent:1`
- `new-sign-in:sent:1`

Mailbox message count:

- `/var/vmail/modula.digital/phase7id-smoke/new`: `4`

## Public DNS Evidence

Public DNS from `dig @1.1.1.1` remains blocked:

- `modula.digital MX`: `0 _dc-mx.7bcf480fc4de.modula.digital.`
- `mail.modula.digital A`: `104.21.27.33`, `172.67.168.220`
- `mail.modula.digital AAAA`: Cloudflare proxy addresses
- SPF records: two records
- DMARC records: two records
- DKIM: `mail._domainkey.modula.digital` returned no TXT record

## Stop Condition

Do not run public API cutover, web registration acceptance, or external delivery acceptance until Cloudflare DNS is repaired and verified externally.
