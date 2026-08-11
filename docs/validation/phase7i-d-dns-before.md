# Phase 7I-D2.1 DNS Before Snapshot

Date: 2026-08-09T09:04:12Z

Repository: `/root/modula-latest`

Branch: `phase7i-trusted-production-alpha`

HEAD: `837303c5aecf71693652b9ab27e397dd3200d839`

Scope: sanitized public DNS and mail-runtime state before Cloudflare DNS mutation. No Cloudflare credentials, SMTP credentials, DKIM private key material, verification URLs, reset tokens, or recipient secrets are recorded here.

## DNS Edit Capability

No Cloudflare DNS-edit credential was present on the host at snapshot time:

- `/root/modula-secrets/`: no token file found.
- Process environment: no Cloudflare-related variable name found.
- `/root`: no Cloudflare token/config file found by filename search.

D2.1 DNS mutation is therefore blocked until the operator provides a least-privilege Cloudflare token for `modula.digital` with `Zone Read` and `DNS Edit`, stored outside Git under `/root/modula-secrets/` with mode `600`, or performs the equivalent dashboard changes.

## Host Mail IP Inventory

Host interface evidence:

- Public IPv4: `87.106.40.136`
- Global IPv6 candidates on `ens6`:
  - `2a02:2479:68:e400::`
  - `2a02:2479:68:e400::1`

Do not publish a `mail.modula.digital` AAAA record until inbound SMTP/TLS reachability over the selected IPv6 address is externally proven.

## Current Public DNS Records

### Apex

`dig +noall +answer modula.digital A`

```text
modula.digital. 300 IN A 104.21.27.33
modula.digital. 300 IN A 172.67.168.220
```

`dig +noall +answer modula.digital AAAA`

```text
modula.digital. 300 IN AAAA 2606:4700:3036::6815:1b21
modula.digital. 300 IN AAAA 2606:4700:3034::ac43:a8dc
```

### WWW

`dig +noall +answer www.modula.digital A`

```text
www.modula.digital. 300 IN A 172.67.168.220
www.modula.digital. 300 IN A 104.21.27.33
```

`dig +noall +answer www.modula.digital AAAA`

```text
www.modula.digital. 300 IN AAAA 2606:4700:3036::6815:1b21
www.modula.digital. 300 IN AAAA 2606:4700:3034::ac43:a8dc
```

`dig +noall +answer www.modula.digital CNAME`

```text
[empty]
```

### API

`dig +noall +answer api.modula.digital A`

```text
api.modula.digital. 300 IN A 104.21.27.33
api.modula.digital. 300 IN A 172.67.168.220
```

`dig +noall +answer api.modula.digital AAAA`

```text
api.modula.digital. 300 IN AAAA 2606:4700:3036::6815:1b21
api.modula.digital. 300 IN AAAA 2606:4700:3034::ac43:a8dc
```

`dig +noall +answer api.modula.digital CNAME`

```text
[empty]
```

### Mail Host

`dig +noall +answer mail.modula.digital A`

```text
mail.modula.digital. 300 IN A 104.21.27.33
mail.modula.digital. 300 IN A 172.67.168.220
```

`dig +noall +answer mail.modula.digital AAAA`

```text
mail.modula.digital. 300 IN AAAA 2606:4700:3036::6815:1b21
mail.modula.digital. 300 IN AAAA 2606:4700:3034::ac43:a8dc
```

`dig +noall +answer mail.modula.digital CNAME`

```text
[empty]
```

Result: FAIL. `mail.modula.digital` resolves to Cloudflare proxy addresses, not the direct mail host.

### Webmail

`dig +noall +answer webmail.modula.digital A`

```text
webmail.modula.digital. 300 IN A 104.21.27.33
webmail.modula.digital. 300 IN A 172.67.168.220
```

`dig +noall +answer webmail.modula.digital AAAA`

```text
webmail.modula.digital. 300 IN AAAA 2606:4700:3034::ac43:a8dc
webmail.modula.digital. 300 IN AAAA 2606:4700:3036::6815:1b21
```

`dig +noall +answer webmail.modula.digital CNAME`

```text
[empty]
```

### MX

`dig +noall +answer modula.digital MX`

```text
modula.digital. 300 IN MX 0 _dc-mx.7bcf480fc4de.modula.digital.
```

`dig +noall +answer _dc-mx.7bcf480fc4de.modula.digital A`

```text
[empty]
```

`dig +noall +answer _dc-mx.7bcf480fc4de.modula.digital AAAA`

```text
_dc-mx.7bcf480fc4de.modula.digital. 300 IN AAAA 2a02:2479:68:e400::
```

Result: FAIL. MX still points at stale `_dc-mx...` workaround state.

### SPF

`dig +noall +answer modula.digital TXT`

```text
modula.digital. 300 IN TXT "modula-verification=active"
modula.digital. 300 IN TXT "v=spf1 a mx ip4:87.106.40.136 ~all"
modula.digital. 300 IN TXT "v=spf1 a mx ip4:87.106.40.136 -all"
```

Result: FAIL. Two SPF records are present. SPF must collapse to exactly one `v=spf1` TXT record.

### DKIM

`dig +noall +answer mail._domainkey.modula.digital TXT`

```text
[empty]
```

Result: FAIL. The active selector is not published publicly.

Safe signer verification:

- Exim DKIM selector: `mail`
- Exim DKIM private-key path: `/etc/exim4/domains/modula.digital/dkim.pem`
- Hestia public-key file: `/usr/local/hestia/data/users/andrei/mail/modula.digital.pub`
- Public key fingerprint from active private signer: `SHA2-256 da4135aea4407227bd436c0bba295d15add2003bcc46af70eba40958967c8475`
- Public key fingerprint from Hestia public file: `SHA2-256 da4135aea4407227bd436c0bba295d15add2003bcc46af70eba40958967c8475`

The safe public DNS value is available from:

```bash
/usr/local/hestia/bin/v-list-mail-domain-dkim-dns andrei modula.digital
```

Do not use `/usr/local/hestia/bin/v-list-mail-domain-dkim` for evidence output because it includes private key material.

### DMARC

`dig +noall +answer _dmarc.modula.digital TXT`

```text
_dmarc.modula.digital. 300 IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@modula.digital; ruf=mailto:dmarc-fail@modula.digital; fo=1; sp=quarantine; aspf=r; adkim=r"
_dmarc.modula.digital. 300 IN TXT "v=DMARC1; p=quarantine; pct=100"
```

Result: FAIL. Two DMARC records are present. D2.1 recovery should use exactly one monitoring policy beginning with `v=DMARC1; p=none`.

The current report destinations are also not routable at snapshot time:

- `dmarc-reports@modula.digital`: unrouteable
- `dmarc-fail@modula.digital`: unrouteable

Do not publish `rua` or `ruf` destinations that bounce. Either create/route those mailboxes first or omit report URIs from the initial monitoring record.

## Reverse DNS And SMTP Identity

`dig -x 87.106.40.136 +noall +answer`

```text
136.40.106.87.in-addr.arpa. 0 IN PTR exchange-api.modula.digital.
```

Result: FAIL for direct Exim delivery. If this VPS performs final outbound delivery, the provider-controlled PTR should be changed to `mail.modula.digital`, and `mail.modula.digital A` should resolve back to `87.106.40.136`.

Effective Exim identity:

```text
primary_hostname = core.modula.digital
smtp_banner = $smtp_active_hostname ESMTP Exim $version_number Ubuntu $tod_full
daemon_smtp_ports = smtp
local_interfaces = <; ::0 ; 0.0.0.0
```

Result: D2.1 identity review required. The SMTP listener currently uses port 25 only; `mail.modula.digital:587` validation cannot pass until Exim is deliberately configured to listen there with valid TLS or the acceptance target is adjusted to the offered SMTP endpoint.

Current STARTTLS certificate check on local port 25 returned:

```text
Verify return code: 18 (self-signed certificate)
```

The available Let's Encrypt certificate for `modula.digital` currently covers only:

```text
DNS:modula.digital, DNS:www.modula.digital
```

It does not cover `mail.modula.digital`.

## Runtime Sanity At Snapshot

Greenfield runtime:

- `modula-production-greenfield-api-1`: image `modula-greenfield-api:837303c5aecf71693652b9ab27e397dd3200d839`, OCI revision `837303c5aecf71693652b9ab27e397dd3200d839`, health `healthy`, runtime UID `999`
- `modula-production-greenfield-worker-1`: image `modula-greenfield-worker:837303c5aecf71693652b9ab27e397dd3200d839`, OCI revision `837303c5aecf71693652b9ab27e397dd3200d839`, status `running`, runtime UID `999`
- Private API live: `GET http://127.0.0.1:4020/v1/health/live` returned `ok: true`
- Private API ready: `GET http://127.0.0.1:4020/v1/health/ready` returned `ok: true`

Mail queues:

- `exim -bpc`: `1`
- `greenfield_mail_jobs`: `4` jobs, all `sent`
- `greenfield_mail_jobs` total attempts: `4`

## Required Cloudflare Mutation Model

Do not open public registration until these pass.

Required DNS changes:

- Set `mail.modula.digital A 87.106.40.136`, DNS only.
- Do not publish `mail.modula.digital AAAA` until IPv6 mail acceptance is proven; remove current proxied Cloudflare AAAA state.
- Replace `modula.digital MX 0 _dc-mx.7bcf480fc4de.modula.digital.` with `modula.digital MX 10 mail.modula.digital.`
- Remove obsolete `_dc-mx.7bcf480fc4de.modula.digital` records only after `mail.modula.digital` resolves directly.
- Collapse SPF to exactly one record based on the actual sender inventory.
- Publish `mail._domainkey.modula.digital TXT` for the active `mail` selector using the matching Hestia public key.
- Collapse DMARC to exactly one monitoring record using `p=none` during recovery.

Required non-Cloudflare follow-up:

- Fix provider PTR for `87.106.40.136` to `mail.modula.digital` or document a relay exception if final outbound delivery is not direct from this VPS.
- Deliberately configure and verify SMTP hostname/TLS endpoint before claiming TLS PASS.
- Prove external inbound delivery to `hello`, `support`, and `security`.
- Prove outbound Greenfield verification and reset mail to controlled external mailboxes with SPF, DKIM, and DMARC PASS in received headers.
