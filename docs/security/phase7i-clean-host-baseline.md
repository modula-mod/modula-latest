# Phase 7I Clean Host Baseline

Date: 2026-08-08
Checkpoint: 7I-A
Status: clean replacement host not yet proven from this shell.

## Trust Boundary

The existing VPS must remain outside the future production trust boundary.

Known affected persistence paths from Phase 7H evidence:

- cron persistence;
- `/var/tmp/.dbus-daemon`;
- `/etc/profile`;
- `/root/.bashrc`.

Removing known persistence was containment only. It is not proof that the old host is clean.

Root-only evidence archive from the affected host:

`/var/backups/modula/security/phase7h-incident-20260808T210902Z/`

Do not destroy this evidence until the replacement environment is operational, accepted, backed up, and no longer depends on old-host state.

## Current Decision

The clean production host is not accepted until a fresh known-good OS image has been provisioned and this document is completed with real command output or private operator evidence.

Application secrets, production SMTP credentials, new signing material, AI provider keys, Cloudflare deployment tokens, GitHub deployment credentials, and customer-facing Alpha traffic must not be placed on the affected host.

## Prohibited Migration Sources

Do not clone the old VPS filesystem. Do not copy these old-host paths or state into the clean host:

- `/etc`
- `/root`
- `/var/tmp`
- `/tmp`
- cron configuration
- systemd configuration
- Docker state
- shell profiles
- old binaries
- old SSH configuration wholesale
- old environment files wholesale

Only explicitly approved application data may migrate.

## Approved Migration Inputs

Allowed inputs require checksum and provenance:

| Input | Source rule | Required proof |
| --- | --- | --- |
| Git source | Clone from GitHub only. | Repository URL, branch, commit, tag inventory. |
| PostgreSQL data | Verified logical dump only. Do not restore the old container. | Dump path, SHA-256, restore log, migration status, integrity checks. |
| Media/object data | Copy only owned application media after malware/path review. | Source path, target path, checksums, ownership check. |
| Module release assets | Resolve immutable GitHub release assets and verify checksum. | Release URL, commit, asset SHA-256, manifest validation. |
| Secrets | New or rotated values from private operator storage only. | Metadata-only rotation proof; no values in Git. |
| DNS/mail config | Recreate from provider control plane and trusted package config. | DNS query output, TLS check, no-open-relay check. |

## Clean Host Record

Fill this after provisioning:

| Field | Value |
| --- | --- |
| Provider | TBD |
| Region | TBD |
| OS image | TBD |
| OS image source | TBD |
| OS version after patching | TBD |
| Kernel | TBD |
| Architecture | TBD |
| Hostname | TBD |
| Created timestamp UTC | TBD |
| Public IPv4 | private operator record |
| Public IPv6 | private operator record |
| Recovery console path | private operator record |
| Primary admin account | private operator record |
| SSH key fingerprints | private operator record |

## Baseline Controls

The clean host must meet these controls before production secrets are installed:

| Control | Minimum acceptance |
| --- | --- |
| OS patches | No pending security updates after initial hardening. |
| SSH | Key authentication only; password SSH disabled; root SSH login restricted or disabled. |
| Firewall | Only required public ports exposed. |
| Brute-force defense | Fail2Ban or equivalent active and enabled. |
| Automatic updates | Security updates enabled with operator-visible logs. |
| Time synchronization | NTP/systemd-timesyncd or equivalent active. |
| Audit logging | Auth, sudo, service, deploy, and application logs retained outside web roots. |
| Docker | Installed from trusted packages; Docker API not publicly exposed; containers use least practical privilege. |
| PostgreSQL | Not publicly exposed; app and migrator roles separated. |
| Redis | Not publicly exposed; authentication configured if Redis is used. |
| Backups | Stored outside web roots with checksum and off-host copy. |
| Web server | Serves Modula production web build, not OpenWebUI, Metro, Expo dev UI, or preview containers. |

## Pre-Secret Verification Commands

Run on the clean host before installing application secrets:

```sh
hostname -f
timedatectl status
apt list --upgradable
sshd -T
ufw status verbose
systemctl is-enabled fail2ban
systemctl is-active fail2ban
systemctl is-enabled unattended-upgrades
ss -tulpn
docker version
docker ps --format '{{.Names}} {{.Ports}}'
iptables -S
iptables -t nat -S
```

Expected exposure:

- public: SSH on the intended port, HTTP, HTTPS, and any explicitly approved mail ports;
- private/internal only: PostgreSQL, Redis, Greenfield internal ports, worker ports, Docker API, Metro, Expo dev servers, and preview-only services.

## Docker Requirements

Before accepting Docker:

- verify Docker packages came from the intended trusted repository;
- verify no container binds `/` from the host;
- verify no container binds the Docker socket unless explicitly justified;
- verify no container uses `--privileged` unless explicitly justified;
- verify OpenWebUI is not exposed as the public Modula site;
- verify Docker-published ports cannot bypass the intended web routing policy.

## Database Recovery Gate

The clean host can receive database state only through the Phase 7I database recovery process:

1. create or select a verified logical dump;
2. compute and record SHA-256;
3. restore into fresh PostgreSQL;
4. run integrity checks;
5. inspect current migration chain from the repository;
6. rehearse migrations against a disposable database;
7. prove rollback where rollback migrations exist;
8. create a fresh pre-production-migration backup;
9. migrate production only after rehearsal passes.

## Mail/DNS Gate

Before Alpha mail acceptance:

- exactly one effective SPF policy;
- exactly one DMARC policy;
- DKIM published;
- MX resolves to the intended mail host;
- `mail.modula.digital` is not proxied through a service incompatible with SMTP;
- TLS is valid;
- no open relay;
- required Alpha mailboxes or aliases exist;
- verification and password-reset emails are delivered from the worker queue, not request handlers.

## Stop Conditions

Stop and report instead of continuing if any of these are found on the clean host:

- evidence of persistence;
- unexpected root compromise;
- unexplained privileged user or SSH key;
- unexpected cron/systemd persistence;
- unexpected Docker socket or privileged container exposure;
- public PostgreSQL or Redis exposure;
- backup corruption;
- inability to rotate or revoke a known exposed secret;
- unexplained unauthorized Cloudflare or GitHub access.

## Acceptance Status

Current acceptance status:

| Gate | Status | Notes |
| --- | --- | --- |
| Fresh host provisioned from known-good OS image | Not proven | Requires provider-side provisioning evidence. |
| Old VPS excluded from trust model | In force | Existing host remains forensic/data-export only. |
| Evidence preserved | In force | Phase 7H evidence archive path recorded above. |
| Baseline controls documented | Complete | This document defines the required controls. |
| Baseline controls verified on clean host | Not started | Requires clean-host shell access. |
| Production secrets installed on clean host | Not started | Must wait for baseline verification and rotation matrix. |
| DNS cutover | Not started | Must wait for clean host, mail, web, API, DB, and backup acceptance. |
