# Modula Mail Operations

This document records the Phase 7H mail split:

- Hestia/Exim/Dovecot can host Modula mailboxes.
- Greenfield transactional email should use an authenticated SMTP relay until VPS deliverability is proven.

## Live Audit Snapshot

Commands run on `core.modula.digital` as root:

- `systemctl status exim4 --no-pager -l`
- `systemctl status dovecot --no-pager -l`
- `ss -ltnp | rg ':(25|465|587|110|143|993|995)\b'`
- `/usr/local/hestia/bin/v-list-mail-domains andrei json`
- `/usr/local/hestia/bin/v-list-mail-domain andrei modula.digital json`
- `/usr/local/hestia/bin/v-list-mail-accounts andrei modula.digital json`
- `/usr/local/hestia/bin/v-list-mail-domain-ssl andrei modula.digital json`
- `dig +short MX modula.digital`
- `dig +short A mail.modula.digital`
- `dig +short TXT modula.digital`
- `dig +short TXT _dmarc.modula.digital`
- `dig +short TXT mail._domainkey.modula.digital`
- `dig +short -x 87.106.40.136`
- `exim -bpc`

Findings:

- Exim is active.
- Dovecot is active.
- Exim listens on port 25.
- Dovecot listens on 110, 143, 993, and 995.
- Ports 465 and 587 were not listening during the audit.
- Hestia user is `andrei`.
- Hestia mail domain `modula.digital` exists with DKIM enabled in Hestia.
- Hestia mail domain `modula.digital` had SSL disabled.
- Hestia SMTP relay fields for `modula.digital` were empty.
- Hestia mailboxes found: `andrei`, `support`, `admin`.
- Required alpha mailboxes not yet present: `hello`, `security`, `no-reply`.
- Public DNS is Cloudflare-hosted.
- Public `mail.modula.digital` and `webmail.modula.digital` resolved to Cloudflare proxy IPs, not directly to the VPS.
- Public MX for `modula.digital` pointed at `_dc-mx.7bcf480fc4de.modula.digital`, not `mail.modula.digital`.
- Public SPF had duplicate records.
- Public DMARC had duplicate records.
- Public `mail._domainkey.modula.digital` did not return DKIM during the audit.
- PTR for `87.106.40.136` returned `exchange-api.modula.digital`, not `mail.modula.digital`.
- `core.modula.digital` resolved locally/publicly to loopback records during the audit.
- Exim queue count was `69781`.
- Hestia mail status showed repeated pipe failures for an uninbox mailbridge command and unrouteable `noreply@core.modula.digital`.

The DKIM private key command exposes private material. Do not paste it into tickets, logs, screenshots, or Git.

## Required DNS State

Cloudflare mail records must be DNS-only, not proxied.

- `mail.modula.digital A 87.106.40.136`
- `modula.digital MX 10 mail.modula.digital`
- exactly one SPF TXT record for `modula.digital`
- `mail._domainkey.modula.digital TXT <Hestia public DKIM record>`
- exactly one `_dmarc.modula.digital TXT` record

Validation DMARC should start at `p=none`, then move to `p=quarantine`, then `p=reject` only after all legitimate senders align.

## Required Server Work

1. Decide whether mailbox submission should be available on 587/465.
2. Enable mail SSL for `modula.digital` in Hestia.
3. Create `hello`, `security`, and `no-reply` mailboxes if they do not already exist.
4. Publish DKIM public DNS from Hestia.
5. Fix duplicate SPF and DMARC records.
6. Fix Cloudflare proxying for `mail` and `webmail`.
7. Configure reverse DNS or use an authenticated transactional relay.
8. Triage the Exim queue before using the server for real mail acceptance.
9. Configure Greenfield worker SMTP relay env vars.

## Acceptance Commands

```bash
dig +short MX modula.digital
dig +short A mail.modula.digital
dig +short TXT modula.digital
dig +short TXT _dmarc.modula.digital
dig +short TXT mail._domainkey.modula.digital
dig +short -x 87.106.40.136
exim -bpc
curl -fsS https://api.modula.digital/v1/health/ready
```

Then run external mailbox tests to Gmail, Outlook/Hotmail, and one independent domain.
