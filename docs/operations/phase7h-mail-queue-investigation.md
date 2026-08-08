# Phase 7H Mail Queue Investigation

Date: 2026-08-08
Host: `core.modula.digital`
Scope: Exim MTA queue only. This is distinct from the Greenfield `greenfield_mail_jobs` transactional-mail queue.

## Stop Rule

Do not enable Greenfield transactional delivery or purge the Exim queue until:

1. the Exim queue source is identified;
2. active generation is contained;
3. queued messages are classified;
4. cleanup uses a documented selector and preserves metadata.

## Source Checkpoint

- Repo: `/home/andrei/modula-latest`
- Branch: `phase7h-production-social-hardening`
- HEAD: `22e42e4717da100570f1df92905de287e2945a52`
- Origin branch HEAD: `22e42e4717da100570f1df92905de287e2945a52`
- Worktree before ops changes: clean
- Baseline gates before mail ops:
  - `pnpm lint`: pass
  - `pnpm typecheck`: pass
  - `pnpm --filter @modula/greenfield-api build`: pass
  - `pnpm --filter @modula/greenfield-worker build`: pass
  - `node scripts/verify-phase7h-registration.mjs`: pass
  - `node scripts/verify-phase7h-mail.mjs`: pass
  - `node scripts/verify-phase7h-api-contract-parity.mjs`: pass
  - `git diff --check`: pass

## Initial Queue Evidence

Commands used metadata-only queue inspection. Message bodies were not dumped.

- `exim -bpc`: `73432`
- Later `exiqsumm` while the queue was still active: `74791`, about `1658MB`
- Sender/recipient summary: local `core.modula.digital`
- Header protocol summary:
  - `local`: all sampled/header-counted messages
  - root-authored local cron messages: dominant class
  - mailer-daemon local error messages: secondary class
- Oldest queued header file observed: 2026-03-10 16:55:28 UTC
- Newest queued header file observed during active incident: 2026-08-08 21:23:08 local time

Representative sanitized sample:

- Class: `LOCAL_SCRIPT_SPAM`
- Protocol: local cron
- Authenticated local user: root
- Sender domain: local host domain
- Recipient domain: local host domain
- Subject pattern: root cron invoking a hidden `/var/tmp/.dbus-daemon` path every five minutes
- Header body line count in oldest sample: 1280
- No external recipients found in aggregate sender/recipient domain counts.

Secondary sampled class:

- Class: `BOUNCE_LOOP`
- Sender: local mailer-daemon empty-envelope delivery-status message
- Recipient: local noreply address on the host domain
- Delivery error: unrouteable local address
- State: frozen delivery error message

Preserve candidates:

- Class: `LEGITIMATE_TRANSIENT_FAILURE`
- Root cron output for known local maintenance scripts
- Exim paniclog notification
- Delivery issue: local mailbox lock contention

## Root Cause

The root crontab contained 2974 duplicate entries of this pattern:

`*/5 * * * * pgrep -f .dbus-daemon || /var/tmp/.dbus-daemon >/dev/null 2>&1`

The referenced `/var/tmp/.dbus-daemon` file was absent at inspection time and no matching process was running. The cron entries generated repeated local root mail. Exim then attempted local delivery into `/var/mail/mail`; high concurrency caused repeated mailbox lock deferrals and a large queue backlog.

This is classified as:

- Primary: `LOCAL_SCRIPT_SPAM`
- Secondary: `OLD_STALE_QUEUE`
- Secondary: `BOUNCE_LOOP`

No evidence from the sampled queue showed external-recipient spam, authenticated mailbox compromise, or a Greenfield transactional-mail source.

## Containment

Active generation was contained before any queue cleanup:

- Root crontab backup: `/root/root-crontab-phase7h-before-20260808T202339Z.cron`
- Before containment:
  - root crontab lines: `2979`
  - suspicious `.dbus-daemon` lines: `2974`
- After containment:
  - root crontab lines: `5`
  - suspicious `.dbus-daemon` lines: `0`
- Remaining root cron entries are the known Modula health report, WebP conversion, GAIA greeting, and GAIA bridge scheduler entries.

After containment, the queue count dropped from `73608` to `55843` through local delivery attempts. This confirms the source was contained, but the queued cron noise still needs cleanup to prevent more stale local mail delivery.

Secondary containment after the first cleanup:

- Root cron still contained dead entries for missing paths:
  - `/home/andrei/scripts/modula-health-report.sh`
  - `/home/andrei/scripts/convert-to-webp.sh`
  - `/home/andrei/web/app.modula.digital/public_html/cron/gaia_daily_greeting.php`
- Those dead entries were removed after backup:
  - `/root/root-crontab-phase7h-before-dead-entry-removal-20260808T204411Z.cron`
- Remaining root cron entry:
  - GAIA bridge scheduler at `/root/dimon/services/gaia-bridge/cron/process-scheduler.js`
- Exim had a custom UnInbox router/transport that intercepted all `modula.digital` delivery and piped to a missing script:
  - `/etc/exim4/conf.d/router/145_uninbox_mailbridge`
  - `/etc/exim4/conf.d/transport/25_uninbox_pipe`
- These snippets were moved out of Exim config and backed up at:
  - `/root/phase7h-mail-config-backups/20260808T204411Z/`
- `update-exim4.conf` and `systemctl reload exim4` completed successfully.
- MariaDB was inactive, causing custom mailbox lookup defers. It was started and `mariadb`, `exim4`, and `dovecot` were enabled for boot.

## Mail Domain Audit

- Hestia owner for `modula.digital`: `andrei`
- Hestia mail domain: exists
- Hestia DKIM: enabled locally
- Hestia DKIM public key file: `/usr/local/hestia/data/users/andrei/mail/modula.digital.pub`
- Hestia mailboxes: `admin`, `andrei`, `support`
- Catch-all: empty
- Antispam: disabled
- Antivirus: disabled
- Mail SSL: disabled
- Hestia SMTP relay: empty
- Exim: active
- Dovecot: active
- MariaDB: active after remediation
- Listeners observed: 25 and 993 only
- Open-relay simulation: external-to-external relay rejected with `550 Relay not permitted`
- After disabling the broken UnInbox pipe, `andrei@modula.digital` routed through `virtual_delivery`.
- `support@modula.digital` and `admin@modula.digital` remained unroutable because the active Exim router uses the custom MariaDB `modula_mailboxes` table, not the Hestia account file, and those addresses were absent from the custom table.

## Public DNS Findings

- VPS public IP: `87.106.40.136`
- `mail.modula.digital` resolved to Cloudflare proxy IPs, not the VPS.
- `mail.modula.digital` also returned Cloudflare IPv6 records.
- MX for `modula.digital` pointed to a Cloudflare `_dc-mx...` target, not `mail.modula.digital`.
- `modula.digital` had two SPF records, causing SPF permerror risk.
- `_dmarc.modula.digital` had two DMARC records, causing DMARC evaluation ambiguity.
- `mail._domainkey.modula.digital` was not published.
- Common DKIM selectors checked (`mail`, `default`, `dkim`, `x`, `hestia`) were not published.
- PTR for `87.106.40.136` returned `exchange-api.modula.digital`, not `mail.modula.digital`.
- `core.modula.digital` resolved to loopback records.

## Cleanup Policy

No global queue purge is approved by this document.

Use metadata-only selectors:

| Category | Selector | Action | Reason |
| --- | --- | --- | --- |
| `LOCAL_SCRIPT_SPAM` | Subject exactly matching the root cron `.dbus-daemon` command | `ARCHIVE_METADATA_THEN_REMOVE` | Generated by contained suspicious cron duplication; local-only; not legitimate user mail |
| `BOUNCE_LOOP` | Subject `Mail delivery failed: returning message to sender` and frozen local noreply recipient | `ARCHIVE_METADATA_THEN_REMOVE` | Local delivery-status loop to unroutable noreply address |
| `LEGITIMATE_TRANSIENT_FAILURE` | Known maintenance cron/paniclog subjects | `PRESERVE` or allow local retry | Low count; may contain useful operational evidence |
| `UNKNOWN` | Anything not matching the above | `PRESERVE` | Requires separate sampling before removal |

Required cleanup record:

- count before
- metadata archive path
- exact selector used
- sample evidence
- count removed
- count after
- residual legitimate or unknown messages

## Cleanup Execution

Cleanup used the policy above and did not use a global queue purge.

### Queue Message Cleanup

Primary suspicious/bounce cleanup:

- Metadata archive: `/var/backups/modula/mail/phase7h-exim-queue-cleanup-20260808T202848Z.tsv`
- Removal log: `/var/backups/modula/mail/phase7h-exim-queue-cleanup-20260808T202848Z.removal.log`
- Checksum file: `/var/backups/modula/mail/phase7h-exim-queue-cleanup-20260808T202848Z.sha256`
- Count before: `44957`
- Selector candidates:
  - `LOCAL_SCRIPT_SPAM`
  - `BOUNCE_LOOP`
- Candidate count: `44913`
- Removed count: `44907`
- Count after: `5`
- Candidate/remove delta reason: Exim queue runner was concurrently delivering local messages while cleanup ran.

Post-cleanup bounce-loop cleanup:

- Metadata archive: `/var/backups/modula/mail/phase7h-exim-postcleanup-bounces-20260808T203645Z.tsv`
- Removal log: `/var/backups/modula/mail/phase7h-exim-postcleanup-bounces-20260808T203645Z.removal.log`
- Checksum file: `/var/backups/modula/mail/phase7h-exim-postcleanup-bounces-20260808T203645Z.sha256`
- Count before: `7`
- Candidate count: `2`
- Removed count: `2`
- Count after: `5`

Residual Exim queue:

- Count: `5`
- Classification:
  - `4` known local WebP maintenance cron notices
  - `1` old Exim paniclog notice
- Action: `PRESERVE`
- External recipients: none observed

### Orphan Spool Cleanup

After queue cleanup, Exim reported only five queued messages but `/var/spool/exim4/input` still held stale orphan files:

- Live `*-H` headers before orphan cleanup: `5`
- Orphan `*-D` data files without matching headers: `152668`
- Other nonstandard stale spool remnants: `56636`

These files were not routable queued messages because they lacked live Exim queue headers. Metadata was archived before removal.

- Metadata archive: `/var/backups/modula/mail/phase7h-exim-orphan-spool-20260808T203048Z.tsv`
- Checksum file: `/var/backups/modula/mail/phase7h-exim-orphan-spool-20260808T203048Z.sha256`
- Input spool files before: `209315`
- Input spool apparent bytes before: `6530238248`
- Orphan files removed: `209304`
- Orphan apparent bytes removed: `6530229556`
- Input spool files after: `13`
- Input spool apparent bytes after: `11673`
- Remaining orphan `*-D` files: `0`
- Remaining nonstandard spool files: `0`

Post-cleanup verification:

- `exim -bpc`: `1` after final bounce cleanup and secondary containment
- residual message: one preserved old Exim paniclog notice
- `*-H` files: `1`
- `*-D` files: `0`
- nonstandard input files: `0`
- `/var/spool/exim4/input`: `49M` allocated on disk
- `/var/spool/exim4/msglog`: `17M`
- `/var/mail`: `843M`
- Root filesystem use: `52%`

The `/var/mail` size is not an Exim queue blocker, but it is residual delivered local cron noise. Do not truncate or delete mailbox storage without a separate mailbox-retention decision.

## Non-Production Greenfield DB Rehearsal

Disposable database: `phase7h_mail_rehearsal_20260808T203927Z`

The first apply attempt failed before any app tables were created because the disposable database schema was owned by the admin role while the repo env connects as the app role. The disposable schema ownership/grant was corrected for that database only.

Rehearsal result:

- Apply all migrations: `001_init_schema` through `029_phase7h_mail`
- Status after apply: pending `[]`
- Rollback latest: `029_phase7h_mail`
- Status after rollback: pending `["029_phase7h_mail"]`
- Reapply: `029_phase7h_mail`
- Status after reapply: pending `[]`
- Disposable database dropped afterward

Additional local checks after the rehearsal:

- `pnpm --filter @modula/greenfield-api test`: pass
- `pnpm --filter @modula/greenfield-worker test`: pass

## Production Blockers Remaining

- Correct Cloudflare DNS to DNS-only mail host records.
- Publish exactly one SPF record.
- Publish exactly one DMARC record, initially `p=none` during validation.
- Publish the Hestia DKIM public key at the active selector.
- Enable/validate Hestia mail TLS if mailbox clients will use Hestia.
- Reconcile Hestia mailboxes with the active custom `modula_mailboxes` routing table or restore standard Hestia mailbox routing.
- Add/route required Alpha mailboxes: `hello`, `security`, and a no-reply sender address that does not create bounces.
- Choose and configure an authenticated SMTP relay for Greenfield worker.
- Store relay credentials outside Git using the source-defined worker variables.
- Run isolated Greenfield mail worker tests before live registration.
- Create and prove a production Greenfield DB backup before live migration.
