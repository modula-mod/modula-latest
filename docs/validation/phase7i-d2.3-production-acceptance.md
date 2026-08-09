# Phase 7I-D2.3 Production Acceptance

Date: 2026-08-09T11:56:22Z

Repository: `/root/modula-latest`

Branch: `phase7i-trusted-production-alpha`

Source SHA: `837303c5aecf71693652b9ab27e397dd3200d839`

Origin branch SHA: `837303c5aecf71693652b9ab27e397dd3200d839`

Backup directory: `/var/backups/modula/phase7i-d2.3/20260809T110307Z/`

This document is sanitized. It does not include Cloudflare tokens, SMTP
passwords, database passwords, DKIM private keys, certificate private keys,
account passwords, verification links, recovery links, or one-time secret
values.

## Acceptance State

The mail identity and Greenfield SMTP path were materially remediated and
externally verified. D2.3 is not complete because multiple hard production
acceptance gates remain unexercised or blocked.

## Source Gate

Start-state source gate:

```text
branch: phase7i-trusted-production-alpha
HEAD: 837303c5aecf71693652b9ab27e397dd3200d839
origin/phase7i-trusted-production-alpha: 837303c5aecf71693652b9ab27e397dd3200d839
unknown source modifications before infrastructure mutation: 0
```

The uncommitted Stage 1 reconciliation document was preserved:

```text
docs/validation/phase7i-d2.2-infrastructure-reconciliation.md
```

Other dirty files were classified as required D2 work in
`docs/validation/phase7i-d2.3-before.md`.

## Backups

Pre-change evidence was captured outside the repository:

```text
/var/backups/modula/phase7i-d2.3/20260809T110307Z/
```

Captured evidence includes sanitized Cloudflare records, `/etc/hosts`,
`/etc/hostname`, Exim inventory, Dovecot inventory, Hestia mail inventory,
firewall state, listening sockets, certificate inventory, mailbox inventory,
PTR, MX, SPF, DKIM, DMARC, and DNS answers.

Cloudflare DNS mutations were recorded in sanitized form:

```text
/var/backups/modula/phase7i-d2.3/20260809T110307Z/cloudflare-d2.3-mutations.sanitized.json
/var/backups/modula/phase7i-d2.3/20260809T110307Z/cloudflare-records-after-dns-repair.sanitized.json
```

## Local Hostname And PTR

Removed only the obsolete `/etc/hosts` association:

```text
87.106.40.136 exchange-api.modula.digital
```

Current resolver evidence:

```text
getent hosts 87.106.40.136 -> 87.106.40.136 mail.modula.digital
dig -x 87.106.40.136 +short -> mail.modula.digital.
dig @1.1.1.1 -x 87.106.40.136 +short -> mail.modula.digital.
dig @8.8.8.8 -x 87.106.40.136 +short -> mail.modula.digital.
```

`/etc/hosts` only affects local resolver behavior. Public PTR authority remains
IONOS, and public resolvers converge on `mail.modula.digital.`

## DNS State

Current public DNS through `@1.1.1.1`:

```text
mail.modula.digital A -> 87.106.40.136
mail.modula.digital AAAA -> [empty]
modula.digital MX -> 10 mail.modula.digital.
modula.digital SPF -> v=spf1 mx ip4:87.106.40.136 -all
mail._domainkey.modula.digital TXT -> selector mail public key present
_dmarc.modula.digital TXT -> v=DMARC1; p=none; adkim=r; aspf=r
```

Cloudflare changes applied:

| Record | Action | Result |
| --- | --- | --- |
| `mail.modula.digital` A | create | DNS-only `87.106.40.136` |
| `mail.modula.digital` AAAA | delete | No public mail AAAA for alpha |
| `modula.digital` MX | update | `10 mail.modula.digital` |
| `modula.digital` SPF | consolidate | Exactly one `v=spf1` policy |
| `_dmarc.modula.digital` TXT | consolidate | Exactly one monitoring DMARC policy |
| `mail._domainkey.modula.digital` TXT | create | Hestia selector `mail` public key |

## IPv6 Decision

```text
MAIL_IPV6_DEFERRED
```

IPv6 was not disabled system-wide. The public mail identity has no AAAA record
for this alpha because stable inbound/outbound IPv6 mail routing, Exim binding,
firewall exposure, PTR, SPF, and TLS were not all proven.

## Exim

Exim now identifies as the canonical SMTP host:

```text
primary_hostname = mail.modula.digital
qualify_domain = mail.modula.digital
daemon_smtp_ports = 25 : 587
disable_ipv6
local_interfaces = 0.0.0.0
tls_certificate = /home/andrei/conf/mail/modula.digital/ssl/modula.digital.pem
tls_privatekey = /home/andrei/conf/mail/modula.digital/ssl/modula.digital.key
```

Listening sockets:

```text
0.0.0.0:25  exim4
0.0.0.0:587 exim4
```

Submission behavior:

```text
587 STARTTLS works
AUTH before STARTTLS not advertised
AUTH after STARTTLS advertised
authenticated no-reply@modula.digital submission works
anonymous external-to-external local relay probe rejected with 550 Relay not permitted
```

External open-relay rejection from a non-VPS SMTP client remains unproven and is
a hard blocker.

## Dovecot

Dovecot is active and narrowed to IMAP over TLS:

```text
protocols = imap
listen = *
disable_plaintext_auth = yes
imap port = 0
imaps port = 993
pop3 port = 0
pops port = 0
```

`doveconf -P` contains an SNI override:

```text
local_name mail.modula.digital {
  ssl_cert = </home/andrei/conf/mail/modula.digital/ssl/modula.digital.pem
  ssl_key = </home/andrei/conf/mail/modula.digital/ssl/modula.digital.key
}
```

Live IMAPS verification:

```text
mail.modula.digital:993 subject=CN = mail.modula.digital
issuer=Let's Encrypt YE2
TLSv1.3 TLS_AES_128_GCM_SHA256
Verify return code: 0 (ok)
IMAPS login for no-reply@modula.digital: ok
```

## TLS

Certificate:

```text
subject=CN = mail.modula.digital
issuer=Let's Encrypt YE2
notBefore=Aug 9 10:18:50 2026 GMT
notAfter=Nov 7 10:18:49 2026 GMT
SAN=DNS:mail.modula.digital
```

Verified endpoints:

```text
mail.modula.digital:25 STARTTLS SMTP -> trusted chain, hostname ok
mail.modula.digital:587 STARTTLS SMTP -> trusted chain, hostname ok
mail.modula.digital:993 IMAPS -> trusted chain, hostname ok
```

The certificate was obtained with DNS-01 validation and installed into the
existing Hestia mail certificate layout. Private key material was not copied
into Git.

## Firewall

Host firewall/listener state now intentionally exposes:

```text
25/tcp
587/tcp
993/tcp
80/tcp
443/tcp
22/tcp
2222/tcp
8083/tcp
```

POP3, POP3S, plaintext IMAP, and SMTPS 465 are not listening publicly.

Operational issue: `v-update-firewall` applies live rules but emits an invalid
Hestia firewall chain warning for the RECIDIVE chain data. The live rules are
correct, but the Hestia firewall data file should be repaired before final
production acceptance.

## Required Mailboxes

| Address | Classification |
| --- | --- |
| `hello@modula.digital` | mailbox |
| `support@modula.digital` | mailbox |
| `security@modula.digital` | mailbox |
| `privacy@modula.digital` | mailbox |
| `legal@modula.digital` | mailbox |
| `no-reply@modula.digital` | mailbox |
| `admin@modula.digital` | mailbox, receive-routable; no plaintext IMAP credential retained for this test |

Each required address was route-checked with Exim and backed by mail storage.

## External Inbound Mail

External inbound path was exercised with the Port25 verifier reply:

```text
Internet -> MX -> Exim -> mailbox -> Dovecot/IMAPS
From: auth-results@verifier.port25.com
Subject: Authentication Report
IMAPS fetch: ok
```

Sanitized details are recorded in
`docs/validation/phase7i-d-mail-production-evidence.md`.

## External Outbound Mail

Authenticated outbound SMTP through `mail.modula.digital:587` was verified with
external receivers.

Port25 verifier evidence:

```text
SPF: pass
DKIM: pass
iprev/PTR: pass
TLS delivery: yes
```

DMARCTester evidence:

```text
source IP: 87.106.40.136
hostname: mail.modula.digital
SPF: pass, aligned
DKIM: pass, selector mail, aligned
DMARC: pass, policy p=none
```

Gmail and Outlook/Microsoft inbox placement were not tested because controlled
test mailbox credentials were not available.

## Greenfield SMTP Cutover

The production worker environment now uses the production submission endpoint:

```text
MODULA_MAIL_TRANSPORT=smtp
MODULA_MAIL_FROM=no-reply@modula.digital
MODULA_SMTP_HOST=mail.modula.digital
MODULA_SMTP_PORT=587
MODULA_SMTP_SECURE=false
MODULA_SMTP_REQUIRE_TLS=true
MODULA_SMTP_TLS_REJECT_UNAUTHORIZED=true
SMTP password present in protected env: true
```

The worker must not use the old private-host TLS exception, TLS verification
disabled, unauthenticated port 25, or hardcoded credentials.

Greenfield external mail path proved:

```text
Greenfield API -> greenfield_mail_jobs -> Worker -> SMTP 587 -> Exim -> external receiver
mail job: verification|sent|1|[message-id-redacted]
external SPF/DKIM/DMARC: pass
```

Current `greenfield_mail_jobs` status counts:

```text
sent:10
```

## Registration And Recovery

Production Greenfield private API lifecycle was exercised with a disposable
account and a local Modula mailbox:

```text
registration succeeds
short password rejected
verification secret generated
verification mail queued and sent
verification mail received in local maildir
verification succeeds
verification replay rejected
login succeeds
session account endpoint succeeds
password recovery request succeeds
password reset mail queued and sent
password reset mail received in local maildir
password reset succeeds
password reset replay rejected
old password rejected
new password login succeeds
```

Limitation: verification and recovery delivery into an independent external
mailbox were not proven. External delivery through Greenfield was proven with
DMARCTester, but the full external mailbox account lifecycle still requires a
controlled recipient mailbox.

## Production Database Gate

Not completed in this D2.3 run.

Required before public cutover:

```text
fresh logical backup
backup hash
isolated restore
migration status check
pending migration check
pending migration rehearsal
rollback/recovery strategy confirmation
```

No schema migration was added by this remediation document update.

## Greenfield Runtime

Running production containers:

```text
modula-production-greenfield-api-1
image=modula-greenfield-api:837303c5aecf71693652b9ab27e397dd3200d839
imageID=sha256:032b5d856eecb22ee334302e66a2c6cc7eb8cec133a82b319c79e338ed833430
user=modula
health=healthy
mounts=/var/lib/modula/greenfield-media -> /var/lib/modula/greenfield-media

modula-production-greenfield-worker-1
image=modula-greenfield-worker:837303c5aecf71693652b9ab27e397dd3200d839
imageID=sha256:6acf94ae60b57fdaae28dc9724630f5fc3739193a15cd431ebc5d3437f26a31d
user=modula
mounts=[none]
```

No running production API or worker container executes source from `/home/andrei`.

Private runtime checks:

```text
GET http://127.0.0.1:4020/v1/health/live -> 200
GET http://127.0.0.1:4020/v1/health/ready -> 200
GET http://127.0.0.1:4020/v1/meta -> 200
GET http://127.0.0.1:4020/v1/stories/rail -> 200 empty rail
```

Public API remains intentionally behind maintenance:

```text
GET https://api.modula.digital/v1/health/live -> 503 MAINTENANCE
GET https://api.modula.digital/v1/stories/rail -> 503 MAINTENANCE
```

Public API maintenance must not be removed until the remaining hard gates pass.

## API Contract

Private live API parity passed:

```text
CI=true MODULA_LIVE_API_BASE_URL=http://127.0.0.1:4020 pnpm verify:phase7i-live-api-parity
Phase 7I live API parity passed: 103 frontend calls covered by 227 source routes and 99 live probes at http://127.0.0.1:4020.
```

Public live API contract is blocked by maintenance mode.

## Stories

Only the private empty rail route was verified:

```text
GET http://127.0.0.1:4020/v1/stories/rail -> 200 empty rail
```

Full Stories acceptance was not exercised:

```text
create story
image story
viewer
author identity
viewed state
expiry
deletion
authorization
account isolation
media failure handling
```

## Social

Not exercised in this D2.3 run.

Required before acceptance:

```text
create post
edit/delete where supported
like/unlike
reactions
comments
comment deletion
share/repost
follow/unfollow
profile feed
notifications
search
saved content where supported
authorization boundaries
```

## Marketplace And Vault Notes

Not completed in this D2.3 run.

Blocked acceptance items:

```text
canonical Vault Notes GitHub tag/release/package/checksum/provenance unresolved
production registry consumption of canonical release metadata unproven
Marketplace -> release -> checksum -> install -> permissions -> enable -> Module Host unproven
Vault Notes install/enable/open/create/edit/folders/search/settings/export/health/disable/re-enable/update/uninstall/reinstall unproven
```

Production must not point Vault Notes at a local development package for final
acceptance.

## Module Runtime

Full Standard 2 runtime acceptance was not completed.

Existing documentation continues to distinguish accepted declarations from
operational runtime support:

```text
docs/architecture/module-standard-2-runtime.md
```

D2.3 added architecture preparation only for the next service-fabric phase:

```text
docs/architecture/modula-backend-service-fabric-roadmap.md
```

Remote functions and community execution remain disabled in production metadata.

## Web Deployment

Canonical local web artifact build passed:

```text
pnpm build:web
pnpm verify:web-build
artifact=dist
files=200
commit=837303c5aecf71693652b9ab27e397dd3200d839
apiOrigin=https://api.modula.digital
dist/version.json sha256=c24293329bae0964503749dca0c93209b9b77561835a275b68792a3a31336a67
dist/release.json sha256=c24293329bae0964503749dca0c93209b9b77561835a275b68792a3a31336a67
dist/checksums.sha256 sha256=dd6e4ab4ec1ed24e17cbe5a319dce5c701ac892fc8a64ab12d220310aa4cc890
```

Public route spot check:

```text
https://modula.digital/ -> 200
https://modula.digital/login -> 200
https://modula.digital/register -> 200
https://modula.digital/discover -> 301
https://modula.digital/marketplace -> 301
https://modula.digital/settings -> 301
```

The deployment gate remains incomplete. The local artifact was built and
verified, but the canonical artifact was not deployed in this run and live
production cutover verification still fails because public API maintenance is
active and live deployment metadata does not match the current branch/commit.

```text
deploy canonical artifact
verify authenticated routes
```

Therefore the web deployment gate remains blocked.

## Public Exposure

Observed intended public listeners include web, mail, SSH/admin ports, and DNS
from host services. Database, Redis, and Greenfield API are not exposed directly
on public interfaces in the observed socket list.

Full post-cutover public exposure audit remains incomplete because public API
and web cutover gates were not completed.

## Observability

Available current checks:

```text
API health: /v1/health/live and /v1/health/ready on private loopback
Worker health: container process and mail queue activity
DB health: production Postgres container healthy
Redis health: production Redis container healthy
Mail queue depth: exim -bpc and greenfield_mail_jobs status counts
Module health: not fully exercised
Module backend health: roadmap only
Event backlog: not fully exercised
Search projector health: not fully exercised
```

Operator visibility is not yet complete for final production acceptance.

## Verification Commands Run

Passed:

```text
CI=true pnpm lint
CI=true pnpm typecheck
CI=true pnpm --filter @modula/greenfield-api build
CI=true pnpm --filter @modula/greenfield-api test
CI=true pnpm --filter @modula/greenfield-worker build
CI=true pnpm --filter @modula/greenfield-worker test
CI=true pnpm build:web
CI=true pnpm verify:web-build
CI=true pnpm verify:phase7e-code-quality
CI=true pnpm verify:phase7e-no-product-mocks
CI=true pnpm verify:phase7h-registration
CI=true pnpm verify:phase7h-mail
CI=true pnpm verify:phase7h-api-contract-parity
CI=true pnpm verify:phase7i-canonical-source
CI=true pnpm verify:phase7i-mail-dns
CI=true pnpm verify:phase7i-mail-production
CI=true MODULA_LIVE_API_BASE_URL=http://127.0.0.1:4020 pnpm verify:phase7i-live-api-parity
CI=true pnpm verify:phase7e-module-service-fabric
CI=true pnpm verify:phase7e-standard2-normalization
CI=true pnpm verify:phase7e-ai-routing
CI=true pnpm verify:phase7e-ai-product-actions
git diff --check
```

Direct checks passed:

```text
dig @1.1.1.1 A mail.modula.digital +short
dig @1.1.1.1 MX modula.digital +short
dig @1.1.1.1 TXT modula.digital +short
dig @1.1.1.1 TXT _dmarc.modula.digital +short
openssl s_client -connect mail.modula.digital:587 -starttls smtp -servername mail.modula.digital -verify_return_error
openssl s_client -connect mail.modula.digital:993 -servername mail.modula.digital -verify_return_error
curl -fsS http://127.0.0.1:4020/v1/health/live
curl -fsS http://127.0.0.1:4020/v1/health/ready
docker compose -f /root/modula-latest/ops/docker/compose.production.yml ps
```

Failed or blocked:

```text
CI=true pnpm verify:phase7e-vault-notes
  FAIL Vault Notes release provenance is missing
  FAIL final lifecycle proof requires MODULA_TEST_DATABASE_URL, MODULA_DATABASE_MIGRATOR_URL or MODULA_DATABASE_URL

CI=true pnpm verify:phase7e-search-platform
  FAIL isolated search-platform proof requires MODULA_TEST_DATABASE_URL, MODULA_DATABASE_MIGRATOR_URL or MODULA_DATABASE_URL

CI=true pnpm verify:phase7e-policy-engine
  FAIL dynamic policy-engine proof requires MODULA_TEST_DATABASE_URL or MODULA_DATABASE_URL

CI=true pnpm verify:phase7e-audit-platform
  FAIL dynamic audit-platform proof requires MODULA_TEST_DATABASE_URL or MODULA_DATABASE_URL

CI=true pnpm verify:phase7e-event-platform
  FAIL dynamic event-platform proof requires MODULA_TEST_DATABASE_URL or MODULA_DATABASE_URL

CI=true pnpm verify:phase7e-notifications
  FAIL dynamic notification-platform proof requires MODULA_TEST_DATABASE_URL or MODULA_DATABASE_URL

CI=true pnpm verify:phase7e-module-runtime-2
  FAIL isolated Standard 2 runtime verifier requires MODULA_TEST_DATABASE_URL pointed at disposable Postgres
  FAIL live web production cutover verifier because deployed marker/API state is not current

CI=true pnpm verify:phase7e-module-backend-runtime
  FAIL isolated runtime test requires MODULA_TEST_DATABASE_URL, MODULA_DATABASE_MIGRATOR_URL, or MODULA_DATABASE_URL

CI=true pnpm verify:phase7e-ai-platform-foundation
  FAIL isolated AI verifier requires MODULA_TEST_DATABASE_URL, MODULA_DATABASE_MIGRATOR_URL, or MODULA_DATABASE_URL

CI=true pnpm verify:phase7e-ai-provider-runtime
  FAIL prior AI foundation dynamic proof remains blocked
  FAIL isolated AI provider runtime verifier requires MODULA_TEST_DATABASE_URL, MODULA_DATABASE_MIGRATOR_URL, or MODULA_DATABASE_URL
```

Not run or not completed in this D2.3 run:

```text
full Marketplace verifier set
full social production acceptance
full Stories mutation/media/authorization acceptance
full public cutover acceptance
```

## Unresolved Issues

- External open-relay rejection from a non-VPS SMTP client is not captured.
- Public API still returns `503 MAINTENANCE`.
- Production DB backup, hash, isolated restore, migration rehearsal, and
  rollback proof are not complete.
- Gmail and Outlook/Microsoft inbox placement are untested.
- Verification and recovery links were not exercised through an independent
  external mailbox account.
- Full Stories acceptance is not complete.
- Full social production acceptance is not complete.
- Vault Notes canonical release provenance and production install lifecycle are
  not complete.
- Marketplace real registry install flow is not complete.
- Full Standard 2 runtime acceptance is not complete.
- Canonical web build/deploy/route acceptance is not complete.
- Full post-cutover public exposure audit is not complete.
- Hestia firewall chain data emits an invalid RECIDIVE chain warning during
  update, despite live firewall rules applying.
- Exim queue contains one stale pre-existing 152-day orphan message:
  `1w06zY-00000001f1H-3TuB`.

## Final Verdict

BLOCKED
