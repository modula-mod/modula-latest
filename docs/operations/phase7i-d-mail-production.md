# Phase 7I-D Mail Production Recovery

Date: 2026-08-09

Source checkpoint: `3cc108d2413689ca4aa0ef37fab161811b3829d3`

## Status

Local mail runtime and Greenfield transactional mail are operational.

Public DNS cutover is blocked because no Cloudflare DNS edit token or Wrangler CLI is present on the host. Public DNS still serves the stale Cloudflare mail records, so external delivery SPF/DKIM/DMARC acceptance is not complete.

## Active Topology

- Inbound/outbound MTA: host Exim 4.97 on `core.modula.digital`, listening on port 25.
- Mailbox auth/delivery authority: `andrei_modula_core.modula_mailboxes`.
- IMAP/POP server: Dovecot, backed by the same SQL mailbox table.
- Greenfield mail path: Greenfield API queues `greenfield_mail_jobs`; Greenfield Worker sends through authenticated SMTP to host Exim.
- Worker SMTP endpoint: `host.docker.internal:25` from the production Docker network.
- Worker sender: `no-reply@modula.digital`.
- API does not send SMTP synchronously from account routes.

## Mailboxes Provisioned

Required production mailboxes now exist in the active SQL mailbox authority and maildir tree:

- `hello@modula.digital`
- `support@modula.digital`
- `security@modula.digital`

Additional operational mailboxes:

- `privacy@modula.digital`
- `legal@modula.digital`
- `no-reply@modula.digital`
- `phase7id-smoke@modula.digital` for Phase 7I-D internal acceptance

## Exim/Dovecot Changes

- Rotated and resynchronized the SQL service credential used by Exim, Dovecot, and Hestia DB metadata.
- Backups were written under `/var/backups/modula/mail/phase7i-d/` and `/var/backups/modula/env/phase7i-d/`.
- Exim DKIM signing macros were enabled for `modula.digital` with selector `mail`.
- Plain SMTP no longer advertises AUTH before STARTTLS.
- STARTTLS SMTP advertises `AUTH PLAIN LOGIN`.
- No-open-relay simulation rejects unauthenticated external relay with `550 Relay not permitted`.

## Greenfield Worker Runtime

The production Worker now runs with:

- `MODULA_ENVIRONMENT=production`
- `MODULA_MAIL_TRANSPORT=smtp`
- `MODULA_MAIL_REQUIRED=true`
- `MODULA_SMTP_HOST=host.docker.internal`
- `MODULA_SMTP_PORT=25`
- `MODULA_SMTP_SECURE=false`
- `MODULA_SMTP_REQUIRE_TLS=true`
- `MODULA_SMTP_TLS_REJECT_UNAUTHORIZED=false`

`MODULA_SMTP_TLS_REJECT_UNAUTHORIZED=false` is a private-relay exception for the current host Exim certificate. It is not a public SMTP trust model.

## Public DNS Blocker

Current public DNS from `@1.1.1.1`:

- `modula.digital MX`: `0 _dc-mx.7bcf480fc4de.modula.digital.`
- `mail.modula.digital A`: Cloudflare proxy IPs
- `mail.modula.digital AAAA`: Cloudflare proxy IPs
- `modula.digital TXT`: two SPF records
- `_dmarc.modula.digital TXT`: two DMARC records
- `mail._domainkey.modula.digital TXT`: no public record returned

Required Cloudflare target:

- `mail.modula.digital A 87.106.40.136`, DNS-only
- `mail.modula.digital AAAA 2a02:2479:68:e400::`, DNS-only, only if IPv6 mail delivery remains intended
- `modula.digital MX 10 mail.modula.digital`
- exactly one SPF TXT record using the selected relay's actual sending hosts
- exactly one DMARC TXT record
- `mail._domainkey.modula.digital TXT` from the Hestia/Exim public DKIM key

Do not proceed to public registration or public API cutover until Cloudflare DNS is repaired and external delivery proves SPF, DKIM, and DMARC pass.
