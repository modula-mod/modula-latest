# Phase 7H VPS Incident Report

Date: 2026-08-08
Host under review: `core.modula.digital`
Branch: `phase7h-final-live-alpha-hardening`
Checkpoint base commit: `3957ff5`

## Trust Decision

The current VPS is not trusted as the production origin.

Root-level persistence existed, and the host must be treated as affected until a clean-host rebuild, data-only restore, and credential rotation are complete. The current server may remain useful as a forensic reference and data export source only.

Do not deploy production registration, transactional mail credentials, fresh session secrets, provider keys, or user-facing Alpha traffic to this host.

## Evidence Archive

Root-only evidence archive:

`/var/backups/modula/security/phase7h-incident-20260808T210902Z/`

The archive contains command-output metadata for cron, systemd units/timers, processes, listeners, Docker inventory, SSH authentication metadata, sudo metadata, Exim queue state, Hestia/system version, package inventory, suspicious binary metadata, shell-history persistence hits, PHP auto-prepend checks, and startup persistence searches.

Checksum manifest:

`/var/backups/modula/security/phase7h-incident-20260808T210902Z/SHA256SUMS`

No malware sample, secret value, SSH key material, recipient list, or full account/IP login trail is committed to Git.

## Confirmed Findings

| Finding | Evidence | Status | Release impact |
| --- | --- | --- | --- |
| Root cron persistence generated mail queue noise through a hidden `/var/tmp/.dbus-daemon` launcher pattern. | See `docs/operations/phase7h-mail-queue-investigation.md`. | Cron entries removed before this report. | Current host remains affected history; clean-host cutover required. |
| Login-shell persistence still existed after cron cleanup. | `/etc/profile:30` and `/root/.bashrc:114` contained `(pgrep -f .dbus-daemon || /var/tmp/.dbus-daemon) >/dev/null 2>&1 &`. | Removed on 2026-08-08 after preserving pre-removal copies. | P0 security blocker for using this host as production. |
| Suspicious binary path was absent at metadata collection time. | `stat`, `sha256sum`, and `file` on `/var/tmp/.dbus-daemon` returned no file. | No sample available to hash or retain. | Absence does not prove the host is clean. |
| SSH is not hardened on the current host. | `sshd -T` showed `permitrootlogin yes` and `passwordauthentication yes`. | Not changed in this report. | Clean host must use hardened SSH before credentials are placed on it. |
| Hestia/admin and DNS exposure need clean-host review. | UFW allowed Hestia `8083`, DNS `53`, SSH, HTTP, HTTPS, and `2222` broadly. | Not changed in this report. | Public surface must be reduced or justified before launch. |
| OpenWebUI is still published on all interfaces at Docker port `3000`. | Docker inventory showed `0.0.0.0:3000->8080/tcp` and `[::]:3000->8080/tcp`. DOCKER-USER had a drop rule for external port 3000. | Not changed in this report. | Must be isolated before product DNS cutover; firewall proof alone is not the clean-host model. |
| Docker inspect found no privileged containers, host network mode, `/` bind mount, or Docker socket bind mount. | `docker inspect` query returned no matches for those high-authority patterns. | Classified as no high-authority Docker finding in sampled live containers. | Containers running as root still need clean-host least-privilege review. |
| PHP auto-prepend search found only empty default settings. | `auto_prepend_file =` and `auto_append_file =` in PHP ini files. | No active PHP auto-prepend persistence found in sampled paths. | Continue review on clean host. |

## Containment Performed

Pre-removal copies were preserved:

- `/var/backups/modula/security/phase7h-incident-20260808T210902Z/etc-profile.before-persistence-removal`
- `/var/backups/modula/security/phase7h-incident-20260808T210902Z/root-bashrc.before-persistence-removal`

Pre-removal hashes:

```text
dc1da9dfac78131003916993bbcc4769292e5b4e9b3650759a1e72a94c6cb7a0  /etc/profile
593cbc6a27b363f8dad2b3bb167f4fd0985e0d11c05e17935ce240fa62b5b19a  /root/.bashrc
```

Removed exact malicious launcher lines from:

- `/etc/profile`
- `/root/.bashrc`

Post-removal hashes:

```text
4ee65c8008c99215817207f1ec2d1398762b7b1de677bc2b554a1d82c09c1282  /etc/profile
2ec0b4ec7e9c10d568eb32e15a97023d8317dd947d57e40b979c61ba54810a24  /root/.bashrc
```

Post-removal targeted startup search for `.dbus-daemon` returned no matches across:

- `/etc/profile`
- `/root/.bashrc`
- `/etc/profile.d`
- `/etc/crontab`
- `/etc/cron.d`
- `/etc/systemd/system`
- `/usr/lib/systemd/system`
- `/etc/sudoers`
- `/etc/sudoers.d`
- `/etc/ssh`
- `/etc/nginx`
- `/etc/exim4`

## Current Host Snapshot

- OS: Ubuntu 24.04.3 LTS
- Kernel: `6.8.0-134-generic`
- Architecture: `x86_64`
- Hestia version: `1.9.9`
- Exim queue count at evidence capture: `1`
- Exim queue summary total at evidence capture: `0`
- Root crontab after prior cleanup: one GAIA bridge scheduler entry remained.
- Fail2Ban: active and enabled.
- UFW: active.

## Account Review Boundary

Login metadata was preserved in the evidence archive, but public documentation intentionally omits source IPs and account access trails. Human review is still required for:

- unexpected source networks;
- unexpected root logins;
- password-authentication usage;
- new SSH keys;
- new sudo users;
- unexpected Hestia users or mailboxes.

## Required Recovery Decision

The only acceptable production path is:

1. provision a clean VPS;
2. patch and harden it before application deployment;
3. rebuild Hestia/system services from trusted packages;
4. clone repositories from GitHub;
5. restore validated data only;
6. rotate every secret that may have been accessible to the affected host;
7. cut over DNS only after clean-host security, mail, API, web, social, Marketplace, and iOS acceptance gates pass.

The repaired current host must not become the trusted production platform.
