# Phase 7I-D2.2 Infrastructure Reconciliation

Date: 2026-08-09T10:54:16Z

Repository: `/root/modula-latest`

Branch: `phase7i-trusted-production-alpha`

HEAD: `837303c5aecf71693652b9ab27e397dd3200d839`

Origin branch HEAD: `837303c5aecf71693652b9ab27e397dd3200d839`

Stage: `STAGE_1_READ_ONLY_FORENSIC_RECONCILIATION`

Result: `STOP_AT_STAGE_1_GATE`

No Cloudflare DNS records, Hestia records, PTR records, hostnames, Exim settings, Dovecot settings, firewall rules, or certificates were changed during this audit.

## Start Gate

`git status --short` at start:

```text
 M package.json
?? docs/validation/phase7i-d-dns-before.md
?? docs/validation/phase7i-d2.1-continuation.md
?? scripts/verify-phase7i-mail-dns.mjs
?? scripts/verify-phase7i-mail-production.mjs
```

Dirty file classification:

| Path | Classification | Reason |
| --- | --- | --- |
| `package.json` | `REQUIRED_D2_WORK` | Adds `verify:phase7i-mail-dns` and `verify:phase7i-mail-production` scripts. |
| `docs/validation/phase7i-d-dns-before.md` | `REQUIRED_D2_WORK` | D2.1 sanitized DNS/mail before snapshot. |
| `docs/validation/phase7i-d2.1-continuation.md` | `REQUIRED_D2_WORK` | D2.1 Cloudflare token and DNS blocker continuation evidence. |
| `scripts/verify-phase7i-mail-dns.mjs` | `REQUIRED_D2_WORK` | D2 mail DNS verifier. |
| `scripts/verify-phase7i-mail-production.mjs` | `REQUIRED_D2_WORK` | D2 mail production verifier. |

Unknown source-code modifications: `0`

Untracked files outside D2 evidence/verifiers: `0`

## Secret Handling

The Cloudflare DNS token file is present at `/root/modula-secrets/cloudflare-modula-dns-token` with mode `600`.

Sanitized status:

```text
CLOUDFLARE_TOKEN: present
SMTP_PASSWORD: present in Worker container env
DKIM_PRIVATE_KEY: present
```

No token, SMTP password, database password, DKIM private key, API key, session secret, OAuth secret, or reset/verification token value was printed or recorded.

## Public DNS Authority

Public forward DNS authority for `modula.digital` is Cloudflare.

Evidence:

```text
dig NS modula.digital +short
earl.ns.cloudflare.com.
tessa.ns.cloudflare.com.

dig SOA modula.digital +noall +answer
modula.digital. 1800 IN SOA earl.ns.cloudflare.com. dns.cloudflare.com. 2407072786 10000 2400 604800 1800
```

Conclusion:

```text
PUBLIC_DNS_AUTHORITY=Cloudflare
HESTIA_DNS_PUBLIC_AUTHORITY=false
IONOS_FORWARD_DNS_AUTHORITY=false
```

Hestia DNS is present locally, but it is not authoritative for public `modula.digital` answers.

## Reverse DNS Authority

Reverse DNS for `87.106.40.136` is delegated to IONOS/UI-DNS authoritative nameservers.

Evidence:

```text
dig NS 106.87.in-addr.arpa +short
rns.ui-dns.org.
rns.ui-dns.biz.
rns.ui-dns.com.
rns.ui-dns.de.
```

Authoritative reverse answer:

```text
dig @rns.ui-dns.com 136.40.106.87.in-addr.arpa PTR +noall +answer
136.40.106.87.in-addr.arpa. 7200 IN PTR mail.modula.digital.
```

Conclusion:

```text
PTR_AUTHORITY=IONOS/UI-DNS
PUBLIC_PTR=mail.modula.digital.
```

## PTR Resolver Comparison

| Resolver | Answer | Classification |
| --- | --- | --- |
| default local `dig -x 87.106.40.136` | `exchange-api.modula.digital.` | `STALE_HOST_CONFIG`, synthetic from `/etc/hosts` via systemd-resolved |
| `resolvectl query 136.40.106.87.in-addr.arpa -t PTR` | `exchange-api.modula.digital` | `STALE_HOST_CONFIG`, `Data from: synthetic` |
| `@1.1.1.1` | `mail.modula.digital.` | `PUBLIC_PROPAGATED` |
| `@8.8.8.8` | `mail.modula.digital.` | `PUBLIC_PROPAGATED` |
| `@9.9.9.9` | `mail.modula.digital.` | `PUBLIC_PROPAGATED` |
| `@212.227.123.16` | `mail.modula.digital.` | `IONOS_RESOLVER_PROPAGATED` |
| `@212.227.123.17` | `mail.modula.digital.` | `IONOS_RESOLVER_PROPAGATED` |
| `@rns.ui-dns.com` | `mail.modula.digital.` | `AUTHORITATIVE` |

Important finding: the current public PTR no longer requires an IONOS UI change. The local false answer is caused by this host file entry:

```text
87.106.40.136 exchange-api.modula.digital
```

## Host Identity

| Check | Current |
| --- | --- |
| `hostname` | `core.modula.digital` |
| `hostname -f` | `core.modula.digital` |
| `/etc/hostname` | `core.modula.digital` |
| Hestia system hostname | `core.modula.digital` |
| Exim `primary_hostname` | `core.modula.digital` |
| Exim `qualify_domain` | `core.modula.digital` |
| Exim local domains | `@:localhost:core.modula.digital:modula.digital` |

`/etc/hosts` contains duplicate loopback entries for `core.modula.digital` and one stale public-IP mapping for `exchange-api.modula.digital`.

## `exchange-api.modula.digital` Provenance

Forward DNS:

```text
dig exchange-api.modula.digital A +short
87.106.40.136

dig @earl.ns.cloudflare.com exchange-api.modula.digital A +noall +answer
exchange-api.modula.digital. 300 IN A 172.67.168.220
exchange-api.modula.digital. 300 IN A 104.21.27.33
```

Cloudflare has no explicit `exchange-api.modula.digital` record. The name resolves because the proxied wildcard record `*.modula.digital A 87.106.40.136` covers it. Local `dig` can also be affected by `/etc/hosts`.

Configuration origins:

| Origin | Evidence | Classification |
| --- | --- | --- |
| `/etc/hosts` | `87.106.40.136 exchange-api.modula.digital` | `STALE_HOST_CONFIG` for mail/PTR checks |
| `/etc/nginx/conf.d/domains/exchange-api.modula.digital.conf` | active vhost proxies to `http://localhost:3001` | `ACTIVE_LEGACY` web/API vhost |
| `/home/andrei/conf/web/exchange-api.modula.digital/ssl/` | self-signed cert/key files dated 2025-11-12 | `ACTIVE_LEGACY_CERT` |
| `/var/lib/letsencrypt/backups/.../exchange-api.modula.digital.conf_*` | historical certbot backups | `HISTORICAL_ONLY` |
| `/root/modula-latest/docs/...` | previous D2/D7H notes mention old PTR | `EVIDENCE_ONLY` |

Direct local HTTPS check, affected by `/etc/hosts`, returns self-signed TLS and `502 Bad Gateway` from nginx because `localhost:3001` is not available.

Decision:

```text
exchange-api.modula.digital=ACTIVE_LEGACY + STALE_HOST_CONFIG
ACTIVE_REQUIRED_FOR_MAIL=false
DO_NOT_CREATE_EXCHANGE_API_DNS_TO_MATCH_OLD_PTR=true
```

Do not delete the active nginx vhost until its product owner/purpose is decided. Do remove or correct the stale `/etc/hosts` mapping during controlled host remediation because it poisons local reverse-DNS verification.

## Cloudflare DNS Inventory

Cloudflare zone: `modula.digital`

Cloudflare API result count: `22`

| Type | Name | Content | Priority | TTL | Proxied | Purpose | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | `*.modula.digital` | `87.106.40.136` |  | auto | true | wildcard web catch-all | `VALID_OPTIONAL`, but causes mail-protocol names to resolve to Cloudflare unless explicit DNS-only records exist |
| A | `modula.digital` | `87.106.40.136` |  | auto | true | public web apex | `REQUIRED` |
| AAAA | `api.modula.digital` | `2a02:2479:68:e400::` |  | auto | true | proxied API origin IPv6 | `VALID_OPTIONAL` |
| AAAA | `mail.modula.digital` | `2a02:2479:68:e400::` |  | auto | true | mail host IPv6 | `MISCONFIGURED` for SMTP/IMAP because proxied and IPv6 mail is unproven |
| AAAA | `modula.digital` | `2a02:2479:68:e400::` |  | auto | true | proxied web apex IPv6 | `VALID_OPTIONAL` |
| AAAA | `webmail.modula.digital` | `2a02:2479:68:e400::` |  | auto | true | webmail origin IPv6 | `UNKNOWN`, proxied webmail needs explicit product decision |
| CAA | `modula.digital` | `0 iodef "mailto:security@modula.digital"` |  | auto | false | CA incident contact | `REQUIRED` |
| CNAME | `autoconfig.modula.digital` | `mail.modula.digital` |  | auto | true | mail autoconfig | `MISCONFIGURED_OR_UNKNOWN`; proxied mail target is not a valid raw mail endpoint |
| CNAME | `autodiscover.modula.digital` | `mail.modula.digital` |  | auto | true | mail autodiscover | `MISCONFIGURED_OR_UNKNOWN`; proxied mail target is not a valid raw mail endpoint |
| CNAME | `ftp.modula.digital` | `modula.digital` |  | auto | true | legacy FTP alias | `LEGACY_UNKNOWN` |
| CNAME | `m.modula.digital` | `app.modula.digital` |  | auto | true | mobile/app alias | `VALID_OPTIONAL` |
| CNAME | `www.modula.digital` | `modula.digital` |  | auto | true | web canonical redirect/shell | `REQUIRED` |
| MX | `modula.digital` | `mail.modula.digital` | 0 | auto | false | inbound mail | `MISCONFIGURED`; public answer is Cloudflare `_dc-mx` because target is proxied |
| TXT | `_acme-challenge.modula.digital` | redacted ACME token value present |  | auto | false | ACME DNS challenge | `UNKNOWN`; do not remove until cert ownership is known |
| TXT | `_dmarc.modula.digital` | `v=DMARC1; p=quarantine; pct=100` |  | auto | false | DMARC policy | `DUPLICATE_MISCONFIGURED` |
| TXT | `_dmarc.modula.digital` | `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@modula.digital; ruf=mailto:dmarc-fail@modula.digital; fo=1; sp=quarantine; aspf=r; adkim=r` |  | auto | false | DMARC policy/reporting | `DUPLICATE_MISCONFIGURED`; report mailboxes are not routable |
| TXT | `_domainkey.modula.digital` | `t=y; o=-` |  | auto | false | DKIM policy marker | `VALID_OPTIONAL_LEGACY` |
| TXT | `modula.digital` | `v=spf1 a mx ip4:87.106.40.136 -all` |  | auto | false | SPF | `DUPLICATE_MISCONFIGURED`; `a` currently authorizes Cloudflare edge IPs |
| TXT | `modula.digital` | `modula-verification=active` |  | auto | false | Modula ownership/product marker | `REQUIRED` |
| TXT | `modula.digital` | `v=spf1 a mx ip4:87.106.40.136 ~all` |  | auto | false | SPF | `DUPLICATE_MISCONFIGURED`; weaker duplicate |
| TXT | `_mta-sts.modula.digital` | `v=STSv1; id=20251103` |  | auto | false | MTA-STS marker | `UNKNOWN`; requires policy endpoint verification |
| TXT | `_smtp._tls.modula.digital` | `v=TLSRPTv1; rua=mailto:tls-rpt@modula.digital` |  | auto | false | SMTP TLS reporting | `MISCONFIGURED`; `tls-rpt@modula.digital` is not routable |

Cloudflare also returns managed public CAA `issue` and `issuewild` records for several CAs. Those are authoritative public answers but not user records returned by the DNS records API list.

## Public DNS State

Key current public answers:

```text
mail.modula.digital A     -> 104.21.27.33, 172.67.168.220
mail.modula.digital AAAA  -> 2606:4700:3034::ac43:a8dc, 2606:4700:3036::6815:1b21
modula.digital MX         -> 0 _dc-mx.7bcf480fc4de.modula.digital.
_dc-mx... A               -> empty
_dc-mx... AAAA            -> 2a02:2479:68:e400::
modula.digital SPF        -> two records
mail._domainkey TXT       -> empty
_dmarc.modula.digital TXT -> two records
```

Cloudflare is synthesizing `_dc-mx.7bcf480fc4de.modula.digital` because the configured MX target is proxied. This is `CLOUDFLARE_GENERATED`, not an explicit record in the API inventory.

## Hestia DNS Inventory

Hestia users:

```text
andrei admin default
```

Hestia DNS domains:

| Domain | Records | Public authority | Status |
| --- | ---: | --- | --- |
| `modula.digital` | 95 | no | `NOT_USED_PUBLICLY` |
| `exchange.modula.digital` | 19 | no | `NOT_USED_PUBLICLY` / `LEGACY_UNKNOWN` |

Because Cloudflare is authoritative, every Hestia DNS record below is not proof of public DNS. It is local control-panel state only.

Complete grouped Hestia `modula.digital` zone inventory:

| Hestia records | Values | Classification |
| --- | --- | --- |
| `@ NS` | `ns1.modula.digital.`, `ns2.modula.digital.` | `NOT_USED`; Cloudflare nameservers are authoritative |
| `@ A` | `87.106.40.136` twice | `DUPLICATED_EXTERNALLY`, duplicate local records |
| `@ AAAA` | `2a02:2479:68:e400::` | `NOT_USED`; web IPv6 mirror only |
| `www CNAME`, `ftp CNAME`, `m CNAME` | `modula.digital.`, `modula.digital.`, `app.modula.digital.` | `DUPLICATED_OR_LEGACY`; not public authority |
| `mail A` | `87.106.40.136` twice | `INTERNAL_ONLY`; desired public Cloudflare record is missing as DNS-only explicit A |
| `mail AAAA` | `2a02:2479:68:e400::` | `STALE_FOR_MAIL`; IPv6 mail acceptance is unproven |
| `@ MX` | `0 mail.modula.digital.` | `DUPLICATED_EXTERNALLY`, but Cloudflare public answer is generated `_dc-mx` because target is proxied |
| `@ TXT SPF` | `v=spf1 a mx ip4:87.106.40.136 -all`, `v=spf1 a mx ip4:87.106.40.136 ~all` | `DUPLICATE_MISCONFIGURED`; same duplicate problem exists publicly |
| `_dmarc TXT` | two quarantine records | `DUPLICATE_MISCONFIGURED`; same duplicate problem exists publicly |
| `_domainkey TXT` | `t=y; o=-` | `DUPLICATED_EXTERNALLY` |
| `_mta-sts TXT`, `_smtp._tls TXT` | `v=STSv1; id=20251103`, `v=TLSRPTv1; rua=mailto:tls-rpt@modula.digital` | `UNKNOWN/MISCONFIGURED`; report mailbox missing |
| `_acme-challenge TXT` | ACME value present | `UNKNOWN`; do not remove until certificate ownership is known |
| `_gaia TXT`, `_dimon TXT` | product markers | `INTERNAL_ONLY_OR_LEGACY`; not public |
| `CAA` | `iodef mailto:security@modula.digital` | `DUPLICATED_EXTERNALLY` |
| service A/AAAA set | `core`, `app`, `forge`, `fx`, `gaia`, `dimon`, `gateway`, `agents`, `n8n`, `drive`, `docs`, `status`, `api`, `cdn`, `media`, `uploads`, `sso`, `id`, `webmail`, `matrix`, `element`, `perfex`, `play`, `wallet`, `explorer`, `rpc`, `seed`, `nodus`, all pointing to `87.106.40.136` and/or `2a02:2479:68:e400::` | `NOT_USED_PUBLICLY`; many are legacy/product-route placeholders requiring separate service inventory |
| wildcard `* A` | `87.106.40.136` | `DUPLICATED_EXTERNALLY`; public Cloudflare wildcard is proxied |
| `ns1/ns2/ns3/ns4 A/AAAA/NS` | local nameserver records, including duplicate `ns3/ns4 AAAA` rows | `STALE_NOT_AUTHORITATIVE` |
| `autoconfig`, `autodiscover CNAME` | `mail.modula.digital.` | `DUPLICATED_EXTERNALLY`; public records are proxied |

Complete grouped Hestia `exchange.modula.digital` inventory:

| Hestia records | Values | Classification |
| --- | --- | --- |
| `@ NS` | `ns1`, `ns2`, `ns3`, `ns4.modula.digital.` | `NOT_USED_PUBLICLY` |
| `@ A`, `mail A`, `webmail A` | `87.106.40.136` | `LEGACY_UNKNOWN` |
| `www CNAME`, `ftp CNAME` | `exchange.modula.digital.` | `LEGACY_UNKNOWN` |
| `@ MX` | `0 mail.exchange.modula.digital.` | `LEGACY_UNKNOWN` |
| `@ TXT SPF`, `_dmarc TXT`, `_domainkey TXT` | local mail policy records | `LEGACY_UNKNOWN` |
| `mail._domainkey TXT` | DKIM public key for `exchange.modula.digital` | `LEGACY_UNKNOWN`; not the active `modula.digital` signer |
| SRV records | `_submission`, `_imap`, `_imaps`, `_pop3`, `_pop3s` to `mail.exchange.modula.digital.` | `LEGACY_UNKNOWN` |

## Canonical SMTP Identity

The canonical SMTP identity should be `mail.modula.digital`, but the live stack is only partially aligned.

```text
CANONICAL_SMTP_HOSTNAME=mail.modula.digital
SMTP_FORWARD_DNS=current: Cloudflare edge A/AAAA; desired: DNS-only A 87.106.40.136
SMTP_REVERSE_DNS=authoritative/public: mail.modula.digital.; local synthetic: exchange-api.modula.digital from /etc/hosts
MX_TARGET=current public: _dc-mx.7bcf480fc4de.modula.digital.; desired: mail.modula.digital.
EXIM_PRIMARY_HOSTNAME=current: core.modula.digital
TLS_HOSTNAME=current: self-signed core.modula.digital; desired: trusted mail.modula.digital
```

Evidence supporting `mail.modula.digital` as canonical:

- Authoritative/public PTR for `87.106.40.136` is now `mail.modula.digital.`
- Cloudflare MX record content is `mail.modula.digital` even though public DNS is synthesized because that target is proxied.
- Hestia mail domain for `modula.digital` expects `mail.modula.digital`.
- Greenfield Worker sends from and authenticates as `no-reply@modula.digital`.

Evidence against considering it complete:

- `mail.modula.digital` forward DNS is still Cloudflare edge, not direct origin.
- Exim identifies as `core.modula.digital`.
- SMTP and IMAPS certificates are self-signed for `core.modula.digital`.
- Submission port `587` is not listening.

## IPv4 And IPv6

IPv4:

```text
PUBLIC_IPV4=87.106.40.136
```

IPv6:

```text
ens6 global IPv6:
2a02:2479:68:e400::/128
2a02:2479:68:e400::1/128

IPv6 route:
default via fe80::1 dev ens6

ping -6 -c 3 2606:4700:4700::1111:
3 transmitted, 3 received, 0% packet loss
```

IPv6 PTR:

```text
2a02:2479:68:e400::  -> ns2.modula.digital.
2a02:2479:68:e400::1 -> ns1.modula.digital.
```

Exim currently binds IPv6:

```text
local_interfaces = <; ::0 ; 0.0.0.0
disable_ipv6 = no_disable_ipv6
```

Decision:

```text
MAIL_IPV6_CURRENTLY_ENABLED_LOCALLY=true
MAIL_IPV6_PRODUCTION_READY=false
MAIL_IPV6_DESIRED_STATE=MAIL_IPV6_DISABLED_INTENTIONALLY until IPv6 PTR/SPF/TLS/external SMTP acceptance are proven
```

Do not delete unrelated proxied web AAAA records as part of mail repair. For mail, do not publish direct `mail.modula.digital AAAA` until an IPv6 mail endpoint has matching PTR, SPF authorization, TLS, firewall allowance, and external acceptance evidence.

## Port Inventory

Focused listener inventory:

| Port | Listener | Current service | Status |
| ---: | --- | --- | --- |
| 25/tcp | `0.0.0.0`, `[::]` | Exim | `ENABLED_LOCAL`, host firewall not allowing external |
| 465/tcp | none | none | `DISABLED` |
| 587/tcp | none | none | `MISSING_REQUIRED_FOR_SUBMISSION` |
| 110/tcp | `0.0.0.0`, `[::]` | Dovecot POP3 | `ENABLED_LOCAL`, not host-firewall allowed; should be disabled unless intentionally supported |
| 995/tcp | `0.0.0.0`, `[::]` | Dovecot POP3S | `ENABLED_LOCAL`, not host-firewall allowed; should be disabled unless intentionally supported |
| 143/tcp | `0.0.0.0`, `[::]` | Dovecot IMAP | `ENABLED_LOCAL`, not host-firewall allowed; plaintext IMAP should not be public |
| 993/tcp | `0.0.0.0`, `[::]` | Dovecot IMAPS | `ENABLED_LOCAL`, host firewall not allowing external |
| 80/tcp | `0.0.0.0`, `[::]` | nginx | `ENABLED` |
| 443/tcp | `0.0.0.0`, `[::]` | nginx | `ENABLED` |
| 8083/tcp | `0.0.0.0`, `[::]` | Hestia nginx | `ENABLED` |

## Firewall Reconciliation

Host firewall:

```text
ufw status verbose
Status: active
Default: deny incoming, allow outgoing, deny routed
Allowed: 22,80,443,8083/tcp; 53/tcp; 53/udp; 2222/tcp, with IPv6 equivalents
Not allowed by UFW: 25, 465, 587, 110, 143, 993, 995
```

Provider firewall:

```text
PROVIDER_FIREWALL_STATE=BLOCKED_EXTERNALLY_FOR_AUTOMATED_AUDIT
```

No `ionosctl` or provider credential file was found on the host. `/etc/cloud/cloud.cfg.d/99_ionos.cfg` confirms IONOS cloud-init context, but does not expose firewall state. The operator-provided screenshot evidence says port 25 exists, but that cannot be verified locally through a supported provider API in this audit.

## Exim Audit

| Check | Current |
| --- | --- |
| Version | Exim `4.97`, built with IPv6, DKIM, DNSSEC, DANE, GnuTLS, authenticators |
| Config file | `/var/lib/exim4/config.autogenerated` |
| `primary_hostname` | `core.modula.digital` |
| `daemon_smtp_ports` | `smtp` only |
| `local_interfaces` | `<; ::0 ; 0.0.0.0` |
| `tls_advertise_hosts` | `*` |
| `tls_certificate` / `tls_privatekey` from `-bP` | empty, resulting in Exim-generated self-signed runtime cert |
| `auth_advertise_hosts` | `*`, but authenticators only advertise without `AUTH_SERVER_ALLOW_NOTLS_PASSWORDS` when TLS is active |
| Auth mechanisms | `PLAIN`, `LOGIN` against `modula_mailboxes` SQL data |
| Relay from hosts | `127.0.0.1`, `::1` |
| Relay to domains | empty |
| Local domains | `@:localhost:core.modula.digital:modula.digital` |
| DKIM selector | `mail` |
| DKIM private-key path | `/etc/exim4/domains/modula.digital/dkim.pem` |
| Queue count | `1` |
| Queue aggregate | `1` queued item for `core.modula.digital`; message bodies were not inspected |

Open-relay probe:

```text
external 203.0.113.10 -> MAIL FROM outside@example.net -> RCPT TO victim@example.org
Result: 550 Relay not permitted
```

Exim is not an open relay by this probe.

SMTP TLS probe:

```text
openssl s_client -connect 127.0.0.1:25 -starttls smtp -servername mail.modula.digital -verify_return_error
Verify return code: 18 (self-signed certificate)
Presented CN: core.modula.digital
```

Auth advertisement:

```text
pre-STARTTLS EHLO: no AUTH advertised
post-STARTTLS EHLO: AUTH PLAIN LOGIN advertised
```

## Dovecot Audit

| Check | Current |
| --- | --- |
| Version | `2.3.21` |
| Protocols | `imap pop3` |
| Mail location | `maildir:/var/vmail/%d/%n` |
| UID/GID | `vmail` / `mail` |
| Auth mechanisms | `plain login` |
| `disable_plaintext_auth` | `no` |
| Passdb/userdb | SQL via `/etc/dovecot/dovecot-sql-modula.conf`, plus Hestia passwd-file fallback |
| SQL password scheme | `PLAIN` |
| TLS cert | `/usr/local/hestia/ssl/certificate.crt` |
| TLS result as `mail.modula.digital:993` | self-signed `core.modula.digital`, verification fails |

Production concerns:

- POP3/POP3S are enabled locally. Do not expose POP publicly unless intentionally supported.
- Plaintext IMAP/POP are enabled locally and `disable_plaintext_auth = no`; host firewall currently prevents public access, but Dovecot protocol policy should still be reconciled.
- Hestia mail accounts and Modula SQL mailboxes are not the same source of truth.

## Mailbox Inventory

Hestia supported CLI for `modula.digital` lists:

```text
andrei
support
admin
```

Active Modula SQL-backed mailbox table has 32 active mailboxes. Required mailbox routing:

| Address | Hestia account | Modula SQL mailbox | Exim route | Classification |
| --- | --- | --- | --- | --- |
| `hello@modula.digital` | no | active | `virtual_delivery` | `MAILBOX` |
| `support@modula.digital` | yes | active | `virtual_delivery` | `MAILBOX` |
| `security@modula.digital` | no | active | `virtual_delivery` | `MAILBOX` |
| `privacy@modula.digital` | no | active | `virtual_delivery` | `MAILBOX` |
| `legal@modula.digital` | no | active | `virtual_delivery` | `MAILBOX` |
| `no-reply@modula.digital` | no | active | `virtual_delivery` | `MAILBOX` |
| `admin@modula.digital` | yes | missing | `Unrouteable address` | `MISSING/BROKEN` |

Report destination routing:

| Address | Route | Classification |
| --- | --- | --- |
| `dmarc-reports@modula.digital` | unrouteable | `MISSING` |
| `dmarc-fail@modula.digital` | unrouteable | `MISSING` |
| `tls-rpt@modula.digital` | unrouteable | `MISSING` |
| `security@modula.digital` | routable | `MAILBOX` |

Do not publish `rua`, `ruf`, or TLS-RPT addresses that bounce.

## SPF Audit

Current public SPF:

```text
v=spf1 a mx ip4:87.106.40.136 -all
v=spf1 a mx ip4:87.106.40.136 ~all
```

Status:

```text
CURRENT_SPF=DUPLICATE_INVALID
```

Outbound architecture found:

- Exim is configured as `internet`, not smarthost.
- No `/etc/exim4/smtp_relay.conf` or domain relay config was found.
- Greenfield Worker submits to host Exim, and Exim performs final delivery.
- Exim IPv6 is enabled locally, but IPv6 mail identity is not configured for `mail.modula.digital`.

Required SPF:

```text
REQUIRED_SPF=one record only, direct sender policy for proven outbound interfaces
```

Recommended Phase 7I D2.2 desired SPF after disabling mail IPv6 or binding outbound to IPv4:

```text
v=spf1 ip4:87.106.40.136 -all
```

Do not include `a` while the apex is proxied through Cloudflare, because it authorizes Cloudflare edge IPs as mail senders. Add `ip6:` only if direct IPv6 mail is deliberately enabled with matching IPv6 PTR, firewall, TLS, and external acceptance evidence.

## DKIM Audit

Current signer:

```text
DKIM_SELECTOR=mail
DKIM_DOMAIN=${lc:${domain:$h_from:}}
DKIM_PRIVATE_KEY=/etc/exim4/domains/modula.digital/dkim.pem
```

Private key exists and was not printed.

Public-key correspondence:

```text
private-derived public key SHA256 DER fingerprint:
41497236c7e7d1aa8783ba7bdc755f1b15f45e0f61baa93c3626ab5f39249406

Hestia public key SHA256 DER fingerprint:
41497236c7e7d1aa8783ba7bdc755f1b15f45e0f61baa93c3626ab5f39249406
```

Public DNS:

```text
dig TXT mail._domainkey.modula.digital +short
[empty]
```

Status:

```text
PRIVATE_KEY_EXISTS=true
PUBLIC_KEY_DER_MATCHES_LOCAL_Hestia_FILE=true
PUBLIC_DKIM_RECORD_PRESENT=false
DKIM_EXTERNAL_PASS_POSSIBLE=false
```

Safe command to print the public DNS value, without exposing private key material:

```bash
/usr/local/hestia/bin/v-list-mail-domain-dkim-dns andrei modula.digital
```

## DMARC Audit

Current public DMARC:

```text
v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@modula.digital; ruf=mailto:dmarc-fail@modula.digital; fo=1; sp=quarantine; aspf=r; adkim=r
v=DMARC1; p=quarantine; pct=100
```

Status:

```text
CURRENT_DMARC=DUPLICATE_INVALID
```

Do not use `p=reject` or `p=quarantine` for production acceptance until SPF and DKIM alignment are proven through external delivery. During alpha recovery, use one monitoring record with `p=none`. Omit `rua`/`ruf` until report mailboxes are routable, or create those mailboxes first.

## MX Audit

Cloudflare API record:

```text
modula.digital MX 0 mail.modula.digital
```

Public authoritative answer:

```text
modula.digital. 300 IN MX 0 _dc-mx.7bcf480fc4de.modula.digital.
_dc-mx.7bcf480fc4de.modula.digital. 300 IN AAAA 2a02:2479:68:e400::
```

Classification:

```text
_dc-mx.7bcf480fc4de.modula.digital=CLOUDFLARE_GENERATED
```

Cause: the configured MX target `mail.modula.digital` is proxied. Cloudflare generated an alternate DNS-only-looking target because normal proxied records cannot be used as MX targets.

Desired:

```text
modula.digital MX 10 mail.modula.digital.
mail.modula.digital A 87.106.40.136 DNS-only
```

Priority `10` is recommended for conventional single-MX posture. Priority `0` is not inherently invalid, but the D2 verifier expects `10`.

## TLS Certificate Inventory

`certbot certificates` found only:

```text
app.atmos.modula.digital
atmos.modula.digital
```

Local certificate files inspected:

| Path | Subject | Issuer | SAN | Status |
| --- | --- | --- | --- | --- |
| `/usr/local/hestia/ssl/certificate.crt` | `core.modula.digital` | self-signed `core.modula.digital` | none shown | `SELF_SIGNED`, used by Dovecot |
| `/home/andrei/conf/web/modula.digital/ssl/modula.digital.crt` | `modula.digital` | Let's Encrypt | `modula.digital`, `www.modula.digital` | `VALID_FOR_WEB_ONLY` |
| `/home/andrei/conf/web/exchange-api.modula.digital/ssl/exchange-api.modula.digital.crt` | `exchange-api.modula.digital` | self-signed | none shown | `ACTIVE_LEGACY_SELF_SIGNED` |

Coverage gaps:

```text
mail.modula.digital: not covered by trusted cert
api.modula.digital: no origin certificate found in inspected Hestia path
webmail.modula.digital: no trusted certificate proven
```

SMTP and IMAPS hostname validation for `mail.modula.digital` currently fails.

## Greenfield Mail Configuration

Live Worker sanitized environment:

```text
MODULA_MAIL_TRANSPORT=smtp
MODULA_MAIL_REQUIRED=true
MODULA_MAIL_FROM=no-reply@modula.digital
MODULA_SMTP_HOST=host.docker.internal
MODULA_SMTP_PORT=25
MODULA_SMTP_SECURE=false
MODULA_SMTP_REQUIRE_TLS=true
MODULA_SMTP_TLS_REJECT_UNAUTHORIZED=false
MODULA_SMTP_USER=no-reply@modula.digital
MODULA_SMTP_PASSWORD=[REDACTED]
```

Current architecture:

```text
Greenfield API
  -> greenfield_mail_jobs
  -> Greenfield Worker
  -> authenticated SMTP over STARTTLS to host Exim on port 25
  -> Exim direct internet delivery
```

The Worker does not bypass the database queue. However, this is still a private-relay exception because TLS verification is disabled and submission is on port `25`, not trusted `587`.

## Greenfield Mail Pipeline

Production Postgres aggregate state:

| Query | Result |
| --- | --- |
| `greenfield_mail_jobs` by status | `sent:4` |
| total jobs | `4` |
| total attempts | `4` |
| jobs with `provider_message_id` | `4` |
| queued/sending/retrying/failed/dead-letter jobs | `0` |
| non-sent jobs with failure messages | `0` |

This proves the local queue/worker/Exim path has worked for prior D2.1 mail. It does not prove external SPF/DKIM/DMARC pass or production submission TLS.

## Public API State

Public Cloudflare-facing API checks:

| Endpoint | Result |
| --- | --- |
| `https://api.modula.digital/v1/health/live` | `503 MAINTENANCE` |
| `https://api.modula.digital/v1/health/ready` | `503 MAINTENANCE` |
| `https://api.modula.digital/v1/meta` | `503 MAINTENANCE` |
| `https://api.modula.digital/v1/stories/rail` | `503 MAINTENANCE` |

Private loopback Greenfield API checks:

| Endpoint | Result |
| --- | --- |
| `http://127.0.0.1:4020/v1/health/live` | `200`, `status=live` |
| `http://127.0.0.1:4020/v1/health/ready` | `200`, `status=ready` |
| `http://127.0.0.1:4020/v1/meta` | `200`, production metadata, email verification required |
| `http://127.0.0.1:4020/v1/stories/rail` | `200`, empty `items` |

Running image/source convergence:

| Container | Image | OCI revision |
| --- | --- | --- |
| `modula-production-greenfield-api-1` | `modula-greenfield-api:837303c5aecf71693652b9ab27e397dd3200d839` | `837303c5aecf71693652b9ab27e397dd3200d839` |
| `modula-production-greenfield-worker-1` | `modula-greenfield-worker:837303c5aecf71693652b9ab27e397dd3200d839` | `837303c5aecf71693652b9ab27e397dd3200d839` |

Maintenance mode was not removed.

## Module Runtime State

Focused verifier results:

| Command | Result | Notes |
| --- | --- | --- |
| `CI=true pnpm verify:phase7i-canonical-source` | `PASS` | 1636 files scanned; canonical `/root` source gate passed. |
| `CI=true pnpm verify:phase7e-no-product-mocks` | `PASS` | No prohibited product mock/demo/fallback patterns found. |
| `CI=true pnpm verify:phase7h-mail` | `PASS` | Source/type mail gate passed. |
| `CI=true pnpm verify:phase7h-registration` | `PASS` | API registration tests passed, with 3 skipped by existing test design. |
| `CI=true pnpm verify:phase7i-mail-dns` | `FAIL` | MX, mail A/AAAA, SPF, DKIM, DMARC fail; PTR failure is local synthetic `/etc/hosts` artifact. |
| `CI=true pnpm verify:phase7i-mail-production` | `FAIL` | DNS gate red; `mail.modula.digital:587` not listening; external evidence doc missing. |
| `CI=true pnpm verify:phase7i-live-api-parity` | `FAIL` | Public API maintenance mode returns 503 for parity probes. |
| `CI=true pnpm verify:phase7e-module-runtime-2` | `FAIL` | Static/build/runtime fixture checks pass; fails because isolated verifier needs `MODULA_TEST_DATABASE_URL` and live web/API cutover is not current. |
| `CI=true pnpm verify:phase7e-module-backend-runtime` | `FAIL` | Backend standard/discovery/auth/gateway/events/webhooks/health/security/conformance pass; isolated runtime test requires DB env. |
| `CI=true pnpm verify:phase7e-vault-notes` | `FAIL` | Standard/data/lifecycle/search/security/host mostly pass; release provenance missing and final lifecycle needs DB env. |

Module runtime is not production-acceptance green. Do not open public cutover based only on private API health.

## Desired-State Table

| Component | Current | Desired | Action |
| --- | --- | --- | --- |
| SMTP hostname | Exim `core.modula.digital`; public PTR `mail.modula.digital` | `mail.modula.digital` canonical across forward DNS, reverse DNS, TLS, submission, Greenfield | inspect/change |
| mail A | Cloudflare edge A via proxied wildcard | `87.106.40.136`, DNS-only explicit record | change Cloudflare |
| mail AAAA | Cloudflare edge AAAA from proxied explicit origin AAAA | no mail AAAA until IPv6 mail is proven, or direct IPv6 with matching PTR/SPF/TLS | change Cloudflare after IPv6 decision |
| PTR | public authoritative `mail.modula.digital`; local synthetic `exchange-api` from `/etc/hosts` | public and local checks return `mail.modula.digital` | keep IONOS PTR, change `/etc/hosts` |
| MX | public `_dc-mx.7bcf480fc4de.modula.digital` | `10 mail.modula.digital.` | change Cloudflare after mail A is DNS-only |
| SPF | duplicate records; includes `a` and `mx` | one valid sender policy, likely `v=spf1 ip4:87.106.40.136 -all` if IPv4-only direct mail | consolidate Cloudflare |
| DKIM | signer key exists; public `mail._domainkey` missing | one matching `mail._domainkey.modula.digital` TXT | publish Cloudflare |
| DMARC | duplicate quarantine records; report mailboxes missing | one `p=none` alpha monitoring record; add report URIs only when routable | consolidate Cloudflare and/or create report mailboxes |
| SMTP 25 | Exim listening locally; UFW not allowing | public server-to-server SMTP if provider and host firewall allow | host/provider firewall verify/change |
| Submission 587 | not listening | authenticated STARTTLS submission, auth only over TLS | configure Exim |
| IMAPS 993 | Dovecot listening locally; UFW not allowing; self-signed cert | enabled only if used, trusted cert for `mail.modula.digital` | configure Dovecot/TLS/firewall |
| POP3/POP3S | enabled locally | disabled unless intentionally supported | configure Dovecot |
| TLS | self-signed `core.modula.digital` on SMTP/IMAPS | trusted cert covering `mail.modula.digital` | obtain/install after DNS direct |
| Greenfield SMTP | `host.docker.internal:25`, STARTTLS, verification disabled | authenticated `mail.modula.digital:587`, STARTTLS, verification enabled | align Worker env after Exim/TLS |
| Admin mailbox | Hestia account exists; Exim unrouteable | routable mailbox or deliberate alias/forwarder | reconcile Hestia/SQL mail source |
| Public API | Cloudflare-facing maintenance 503 | keep maintenance until mail and module gates pass; then cut over | blocked until acceptance |
| Module runtime | source checks mixed, live/API acceptance red | all module/runtime/Vault Notes gates green | rerun with disposable DB/live cutover |

## Required Changes

`CHANGE_REQUIRED`:

- Add explicit Cloudflare `mail.modula.digital A 87.106.40.136` with `proxied=false`.
- Remove or disable Cloudflare proxied `mail.modula.digital AAAA` until IPv6 mail acceptance is proven.
- Reconcile `modula.digital MX` so public DNS returns `10 mail.modula.digital.` and no `_dc-mx` workaround.
- Collapse SPF to exactly one record that authorizes only real outbound senders.
- Publish the active `mail._domainkey.modula.digital` TXT record from Hestia's safe DKIM DNS command.
- Collapse DMARC to exactly one alpha-safe `p=none` monitoring record.
- Remove/correct `/etc/hosts` stale mapping for `87.106.40.136 exchange-api.modula.digital`.
- Configure trusted TLS cert for `mail.modula.digital`.
- Configure Exim submission on `587` with STARTTLS and authenticated relay only.
- Reconfigure Greenfield Worker to use the trusted submission endpoint and enable TLS verification.
- Reconcile `admin@modula.digital` routing.
- Decide whether POP3/POP3S are intentionally supported; disable if not.
- Verify and, if approved, minimally allow required host firewall ports.

`KEEP`:

- Keep public PTR as `mail.modula.digital`; do not change IONOS PTR again based on local default `dig`.
- Keep Cloudflare authority for `modula.digital`.
- Keep apex, `www`, and `api` web/API proxy state during mail repair unless a separate web cutover requires changes.
- Keep `modula-verification=active`.
- Keep CAA incident contact to `security@modula.digital`; that mailbox routes.
- Keep production API maintenance until mail and runtime acceptance gates pass.

`REMOVE_LEGACY`:

- Remove one SPF duplicate.
- Remove duplicate DMARC records and replace with one record.
- Remove the proxied mail AAAA if IPv6 mail remains intentionally disabled.
- Remove report URIs that point to unroutable mailboxes, or create the mailboxes first.
- Remove/update stale `/etc/hosts` `exchange-api` mapping.

`OPTIONAL`:

- Add MTA-STS and TLS-RPT only after HTTPS policy endpoint and report mailbox are proven.
- Add `465` only if implicit TLS submission is explicitly supported.
- Support direct mail IPv6 only after IPv6 PTR/SPF/TLS/external delivery are proven.
- Keep or remove `autoconfig`/`autodiscover` only after choosing a supported mail-client autodiscovery model.

`BLOCKED_EXTERNALLY`:

- Provider firewall state cannot be verified from this host without IONOS control-plane access.
- External inbound/outbound mail acceptance requires controlled external mailbox accounts.
- Public registration and password recovery cannot be accepted until real external mail verification passes.
- Public API cutover remains blocked by maintenance mode and live parity failures.
- Marketplace/Vault Notes final acceptance remains blocked by release provenance and disposable DB/live acceptance requirements.

## Records That Must Not Be Changed Yet

- Do not delete the Cloudflare wildcard `*.modula.digital` until all wildcard-covered services are inventoried. Add explicit DNS-only mail records instead.
- Do not delete `_acme-challenge.modula.digital` until certificate ownership and renewal flow are confirmed.
- Do not delete `exchange-api.modula.digital` nginx config yet; it is active legacy configuration even though it is not the canonical mail identity.
- Do not change IONOS PTR; authoritative and public resolvers already return `mail.modula.digital`.
- Do not remove public API maintenance during this stage.

## Legacy Or Misconfigured Records Safe To Remove After Backup

These are safe to remove or replace only after current Cloudflare record IDs and sanitized backups are captured:

- One of the two SPF records, then replace the remaining SPF with the final one-record policy.
- Both current DMARC records, replacing them with one `p=none` recovery policy.
- Cloudflare proxied `mail.modula.digital AAAA` if mail IPv6 remains disabled.
- DMARC/TLS report URIs pointing to missing mailboxes, unless those mailboxes are created first.

`_dc-mx.7bcf480fc4de.modula.digital` is Cloudflare-generated, not an explicit API record. It should disappear after `mail.modula.digital` is DNS-only and MX is reconciled.

## Unknown Records Requiring Investigation

- `exchange-api.modula.digital` active nginx vhost and `/home/andrei` certificate path ownership.
- Cloudflare `ftp.modula.digital`.
- Cloudflare/Hestia `autoconfig` and `autodiscover` intended mail-client behavior.
- Cloudflare `_mta-sts` and `_smtp._tls` without routable report mailbox.
- Hestia `exchange.modula.digital` DNS/mail zone.
- Hestia-only service subdomains not present in Cloudflare API.
- Provider firewall state.

## Stage 1 Stop Gate

Do not proceed to Stage 2 automatically from this report.

Reason:

- DNS mutation is supported by evidence and reversible, but it is not the only required mutation.
- Host `/etc/hosts`, Exim, Dovecot, TLS, UFW, Greenfield Worker env, mailbox state, and provider firewall must be sequenced with backups and service restart plans.
- External acceptance accounts are still required for SPF/DKIM/DMARC, registration, and password recovery proof.
- Public API and module runtime acceptance are intentionally red or blocked.

Proposed controlled remediation order:

1. Capture sanitized Cloudflare DNS backup with record IDs.
2. Add explicit DNS-only `mail.modula.digital A 87.106.40.136`.
3. Remove/disable proxied `mail.modula.digital AAAA` unless choosing full IPv6 mail.
4. Reconcile MX to `10 mail.modula.digital.`.
5. Publish matching `mail._domainkey.modula.digital` TXT.
6. Replace duplicate SPF with one direct-sender policy.
7. Replace duplicate DMARC with one alpha monitoring policy.
8. Correct `/etc/hosts` so local PTR checks are not synthetic `exchange-api`.
9. Obtain trusted `mail.modula.digital` certificate after direct DNS resolves.
10. Configure Exim `587` authenticated STARTTLS submission and trusted TLS.
11. Configure Dovecot TLS and protocol exposure intentionally.
12. Reconcile UFW/provider firewall least-privilege openings.
13. Move Greenfield Worker to `mail.modula.digital:587` with TLS verification enabled.
14. Prove external inbound/outbound mail headers: SPF pass, DKIM pass, DMARC pass, PTR match, TLS.
15. Prove Greenfield registration, verification, forgot-password, reset, and login with a disposable external mailbox.
16. Only then continue public API cutover, registration opening, Marketplace/Vault Notes, module runtime, and social acceptance gates.

Stage 2 status:

```text
STAGE_2_ENTERED=false
```
