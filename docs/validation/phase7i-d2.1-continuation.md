# Phase 7I-D2.1 Continuation Evidence

Date: 2026-08-09

Repository: `/root/modula-latest`

Branch: `phase7i-trusted-production-alpha`

HEAD: `837303c5aecf71693652b9ab27e397dd3200d839`

## Start Gate

- `git branch --show-current`: `phase7i-trusted-production-alpha`
- `git rev-parse HEAD`: `837303c5aecf71693652b9ab27e397dd3200d839`
- `/root/modula-secrets/cloudflare-modula-dns-token`: present
- token mode: `600`
- token value: not displayed and not recorded

The worktree already contained the D2.1 verifier and DNS snapshot files from the prior continuation.

## Cloudflare Authentication

Token verification:

```text
success=true
status=active
```

Zone lookup:

```text
modula.digital
zone id: 36ff0ed12c7c3a3603f1ad60c4500c70
visible zones: 1
```

The token can see only `modula.digital` through the zone listing endpoint.

## Cloudflare DNS Record Access Blocker

Cloudflare DNS record listing failed:

```text
success=false
errors=[{"code":10000,"message":"Authentication error"}]
```

Endpoint:

```text
GET /client/v4/zones/36ff0ed12c7c3a3603f1ad60c4500c70/dns_records
```

Result: Cloudflare mutation is blocked because the token can verify and read the zone but cannot read DNS records. Do not create replacement records blindly because that can create duplicate SPF, DMARC, MX, or host records.

Required token permission correction:

- Zone: `modula.digital`
- `Zone Read`
- DNS record read access
- DNS record edit access

## Cloudflare DNS Record Access Recheck

Rechecked after the token was replaced.

Cloudflare DNS record listing now succeeds:

```text
success=true
errors=[]
result_count=22
```

Relevant Cloudflare record state from the successful list call:

```text
modula.digital A 87.106.40.136 proxied=true
mail.modula.digital AAAA 2a02:2479:68:e400:: proxied=true
modula.digital MX mail.modula.digital priority=0
_dmarc.modula.digital TXT "v=DMARC1; p=quarantine; pct=100"
_dmarc.modula.digital TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@modula.digital; ruf=mailto:dmarc-fail@modula.digital; fo=1; sp=quarantine; aspf=r; adkim=r"
modula.digital TXT "v=spf1 a mx ip4:87.106.40.136 -all"
modula.digital TXT "modula-verification=active"
modula.digital TXT "v=spf1 a mx ip4:87.106.40.136 ~all"
```

Even though the Cloudflare API record currently stores MX content `mail.modula.digital`, public DNS still returns the `_dc-mx` target because the mail hostname is proxied. DNS mutation must still proceed in the controlled order after PTR is corrected.

## Live DNS Re-Read

DNS had not changed since the previous snapshot.

`dig +short A mail.modula.digital`

```text
104.21.27.33
172.67.168.220
```

`dig +short AAAA mail.modula.digital`

```text
2606:4700:3034::ac43:a8dc
2606:4700:3036::6815:1b21
```

`dig +short MX modula.digital`

```text
0 _dc-mx.7bcf480fc4de.modula.digital.
```

`dig TXT modula.digital`

```text
modula.digital. 300 IN TXT "v=spf1 a mx ip4:87.106.40.136 ~all"
modula.digital. 300 IN TXT "v=spf1 a mx ip4:87.106.40.136 -all"
modula.digital. 300 IN TXT "modula-verification=active"
```

`dig TXT _dmarc.modula.digital`

```text
_dmarc.modula.digital. 300 IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@modula.digital; ruf=mailto:dmarc-fail@modula.digital; fo=1; sp=quarantine; aspf=r; adkim=r"
_dmarc.modula.digital. 300 IN TXT "v=DMARC1; p=quarantine; pct=100"
```

`dig TXT mail._domainkey.modula.digital`

```text
NXDOMAIN
```

## Host IP Confirmation

Public IPv4 on `ens6`:

```text
87.106.40.136
```

Global IPv6 candidates on `ens6`:

```text
2a02:2479:68:e400::
2a02:2479:68:e400::1
```

No `mail.modula.digital` AAAA should be published until external IPv6 SMTP/TLS acceptance is proven.

## PTR Provider

Provider evidence:

- RIPE netname: `MORE-A0709`
- RIPE description: `IONOS SE`
- origin ASN: `AS8560`
- ipinfo org: `AS8560 IONOS SE`
- virtualization: `kvm`
- cloud config: `/etc/cloud/cloud.cfg.d/99_ionos.cfg`

No `ionosctl` or legacy `oneandone` CLI was found. No provider credential environment variable was found.

Current PTR:

```text
exchange-api.modula.digital.
```

PTR recheck after Cloudflare token replacement:

```text
exchange-api.modula.digital.
```

Result: FAIL. PTR has not been corrected.

Required provider-side PTR change:

```text
87.106.40.136 -> mail.modula.digital
```

This must be made through the IONOS control panel/API by an operator with provider credentials.

## Local SMTP/TLS Blockers

Exim is not listening on `587/tcp`, and the current STARTTLS certificate is self-signed. A valid certificate covering `mail.modula.digital` cannot be requested honestly until DNS points `mail.modula.digital` directly at this VPS.

## Stop Condition

D2.1 remains blocked. Do not continue to D3 public API cutover or public registration until:

- Cloudflare DNS record access is available and DNS is mutated safely.
- IONOS PTR is changed or an explicit relay exception is documented.
- Exim submission on `587/tcp` is configured.
- A valid certificate covering `mail.modula.digital` is installed for Exim/Dovecot.
- External inbound and Greenfield outbound delivery are proven with SPF, DKIM, and DMARC PASS.
