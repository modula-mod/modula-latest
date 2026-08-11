# Phase 7I-D2.3 Before State

Date: 2026-08-09T11:03:07Z

Repository: `/root/modula-latest`

Branch: `phase7i-trusted-production-alpha`

HEAD: `837303c5aecf71693652b9ab27e397dd3200d839`

Origin branch HEAD: `837303c5aecf71693652b9ab27e397dd3200d839`

Backup directory: `/var/backups/modula/phase7i-d2.3/20260809T110307Z/`

No Cloudflare token, SMTP password, database password, DKIM private key, API key, verification token, or reset token is recorded in this document.

## Source Gate

`git status --short` before infrastructure mutation:

```text
 M package.json
?? docs/validation/phase7i-d-dns-before.md
?? docs/validation/phase7i-d2.1-continuation.md
?? docs/validation/phase7i-d2.2-infrastructure-reconciliation.md
?? scripts/verify-phase7i-mail-dns.mjs
?? scripts/verify-phase7i-mail-production.mjs
```

Dirty file classification:

| Path | Classification | Reason |
| --- | --- | --- |
| `package.json` | `REQUIRED_D2_WORK` | Adds Phase 7I mail DNS and production verifier scripts. |
| `docs/validation/phase7i-d-dns-before.md` | `REQUIRED_D2_WORK` | Prior D2 DNS/mail before snapshot. |
| `docs/validation/phase7i-d2.1-continuation.md` | `REQUIRED_D2_WORK` | Prior D2.1 Cloudflare token and DNS blocker continuation evidence. |
| `docs/validation/phase7i-d2.2-infrastructure-reconciliation.md` | `REQUIRED_D2_WORK` | Stage 1 read-only infrastructure reconciliation; preserve uncommitted. |
| `scripts/verify-phase7i-mail-dns.mjs` | `REQUIRED_D2_WORK` | Phase 7I mail DNS verifier. |
| `scripts/verify-phase7i-mail-production.mjs` | `REQUIRED_D2_WORK` | Phase 7I production mail verifier. |

Unknown source modifications: `0`

## Captured Evidence

Sanitized or low-risk copies and inventories were captured outside Git:

| Evidence | Backup file |
| --- | --- |
| Cloudflare zone metadata | `cloudflare-zone.sanitized.json` |
| Cloudflare DNS records | `cloudflare-records.sanitized.json` |
| `/etc/hosts` | `etc-hosts.raw` |
| `/etc/hostname` | `etc-hostname.raw` |
| Exim effective config | `exim-bP.txt` |
| Exim file inventory | `exim-file-inventory.txt` |
| Dovecot effective config | `dovecot-effective.redacted.txt` |
| Dovecot file inventory | `dovecot-file-inventory.txt` |
| Hestia mail domains | `hestia-mail-domains.json` |
| Hestia `modula.digital` mail accounts | `hestia-modula-mail-accounts.json` |
| Hestia DKIM DNS output | `hestia-modula-dkim-dns.txt` |
| Hestia mail file inventory | `hestia-mail-file-inventory.txt` |
| UFW state | `ufw-status.txt` |
| iptables state | `iptables-save.txt` |
| listening sockets | `listening-sockets.txt` |
| certificate inventory | `certificate-file-inventory.txt` |
| current DNS answers | `dns-*.txt` |

## Public DNS Authority

`modula.digital` public forward DNS authority remains Cloudflare:

```text
earl.ns.cloudflare.com.
tessa.ns.cloudflare.com.
```

Cloudflare DNS record list was accessible through the existing least-privilege token and returned `22` records. Token value was not displayed or written.

## Local Hostname State

`/etc/hostname`:

```text
core.modula.digital
```

`/etc/hosts` contains this stale public-IP mapping:

```text
87.106.40.136 exchange-api.modula.digital
```

This mapping causes local reverse lookups through the system resolver to report `exchange-api.modula.digital` even though public PTR resolvers report `mail.modula.digital`.

## PTR State

| Resolver | Answer | Classification |
| --- | --- | --- |
| default local `dig -x 87.106.40.136 +short` | `exchange-api.modula.digital.` | `STALE_HOST_CONFIG` |
| `@1.1.1.1` | `mail.modula.digital.` | `PUBLIC_PROPAGATED` |
| `@8.8.8.8` | `mail.modula.digital.` | `PUBLIC_PROPAGATED` |

Public PTR is already correct:

```text
87.106.40.136 -> mail.modula.digital.
```

## Cloudflare Records To Modify

| ID | Type | Name | Previous value | Previous proxy | Previous TTL | Replacement |
| --- | --- | --- | --- | --- | --- | --- |
| `c1abc76b817ea7f6fb04e033d08279c2` | `AAAA` | `mail.modula.digital` | `2a02:2479:68:e400::` | `true` | `1` | Remove for alpha unless IPv6 mail proof is completed. |
| `bb8fd7218b8a99e3d56fea45b80a969d` | `MX` | `modula.digital` | `mail.modula.digital`, priority `0` | `false` | `1` | Keep target `mail.modula.digital`, set priority `10`. |
| `a57299a0ed421c34bf0fbe7fe9745464` | `TXT` | `modula.digital` | `"v=spf1 a mx ip4:87.106.40.136 -all"` | `false` | `1` | Keep one SPF without `a`: `"v=spf1 mx ip4:87.106.40.136 -all"`. |
| `5e7c6f4d36cb079c2bf3fda4bcacaf03` | `TXT` | `modula.digital` | `"v=spf1 a mx ip4:87.106.40.136 ~all"` | `false` | `1` | Delete duplicate SPF. |
| `97525a4793c6a3a9796970d77de56b56` | `TXT` | `_dmarc.modula.digital` | `"v=DMARC1; p=quarantine; pct=100"` | `false` | `1` | Replace with monitoring policy or delete duplicate. |
| `b815bb5bcd3bb07b406a72d1c03b9bf4` | `TXT` | `_dmarc.modula.digital` | `"v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@modula.digital; ruf=mailto:dmarc-fail@modula.digital; fo=1; sp=quarantine; aspf=r; adkim=r"` | `false` | `1` | Delete duplicate until report mailboxes are proven routable. |
| `new` | `A` | `mail.modula.digital` | Absent explicit record; wildcard currently resolves to Cloudflare edge A records. | n/a | n/a | Create DNS-only `87.106.40.136`. |
| `new` | `TXT` | `mail._domainkey.modula.digital` | Absent public record. | n/a | n/a | Publish Hestia DKIM public key for selector `mail`. |

Do not alter unrelated proxied web records during D2.3 mail remediation.

## Public Mail DNS Before

`mail.modula.digital A`:

```text
104.21.27.33
172.67.168.220
```

`mail.modula.digital AAAA`:

```text
2606:4700:3036::6815:1b21
2606:4700:3034::ac43:a8dc
```

`modula.digital MX`:

```text
0 _dc-mx.7bcf480fc4de.modula.digital.
```

`modula.digital TXT`:

```text
"v=spf1 a mx ip4:87.106.40.136 ~all"
"modula-verification=active"
"v=spf1 a mx ip4:87.106.40.136 -all"
```

`mail._domainkey.modula.digital TXT`:

```text
[empty]
```

`_dmarc.modula.digital TXT`:

```text
"v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@modula.digital; ruf=mailto:dmarc-fail@modula.digital; fo=1; sp=quarantine; aspf=r; adkim=r"
"v=DMARC1; p=quarantine; pct=100"
```

## IPv6 Decision Before Mutation

The host has global IPv6 addresses on `ens6`, but production mail readiness over IPv6 is unproven:

- No proven public `mail.modula.digital` IPv6 SMTP/TLS path.
- No proven mail-specific IPv6 PTR alignment.
- No proven Exim/Dovecot IPv6 binding and firewall acceptance for the canonical mail identity.

Decision for D2.3 alpha before mutation:

```text
MAIL_IPV6_DEFERRED
```

This does not disable system-wide IPv6. It means the public mail identity should not publish an AAAA record until the mail-specific IPv6 acceptance proof exists.

## Exim Before

Relevant `exim -bP` values:

```text
primary_hostname = core.modula.digital
qualify_domain = core.modula.digital
daemon_smtp_ports = smtp
auth_advertise_hosts = *
tls_certificate =
tls_privatekey =
```

Exim listens on `25/tcp` only. Port `587/tcp` is not listening before remediation.

## Dovecot Before

Relevant `doveconf -n` values:

```text
protocols = imap pop3
disable_plaintext_auth = no
mail_location = maildir:/var/vmail/%d/%n
ssl_cert = </usr/local/hestia/ssl/certificate.crt
```

Dovecot listens on `110`, `143`, `993`, and `995` before remediation. POP3 and public plaintext IMAP/POP3 require correction or explicit firewall blocking before production acceptance.

## Required Mailbox Classification Before

`/usr/local/hestia/bin/v-list-mail-accounts andrei modula.digital json` returned these real mailboxes:

```text
andrei
support
admin
```

Required address classification before remediation:

| Address | Classification |
| --- | --- |
| `hello@modula.digital` | `UNCONFIGURED` |
| `support@modula.digital` | `mailbox` |
| `security@modula.digital` | `UNCONFIGURED` |
| `privacy@modula.digital` | `UNCONFIGURED` |
| `legal@modula.digital` | `UNCONFIGURED` |
| `no-reply@modula.digital` | `UNCONFIGURED` |
| `admin@modula.digital` | `mailbox` |

## Current Blockers

- `mail.modula.digital` resolves through Cloudflare proxy/wildcard instead of direct DNS-only `87.106.40.136`.
- Public MX is synthesized to `_dc-mx...` because the mail target is proxied.
- SPF has two records.
- DMARC has two records.
- DKIM selector `mail` is configured locally but not published publicly.
- Local `/etc/hosts` poisons reverse lookup evidence with `exchange-api.modula.digital`.
- Exim is not configured for authenticated submission on `587/tcp`.
- Exim SMTP identity is still `core.modula.digital`.
- Dovecot publicly exposes POP3 and plaintext-capable auth before production hardening.
- Several required role mailboxes are not yet configured.
