# Phase 7H Clean Host Rebuild

Date: 2026-08-08
Status: not provisioned in this repository checkpoint.

## Rule

The affected VPS must not be cloned into production. Restore validated data, not system-level executable state.

Do not copy these paths from the affected host into the clean host:

- `/etc`
- `/root`
- shell profiles
- cron trees
- systemd unit trees
- Hestia system configuration tree
- Exim/Nginx custom fragments
- Docker volumes wholesale
- arbitrary binaries from `/tmp` or `/var/tmp`

## Required Clean Host Record

Fill this after provisioning:

| Field | Value |
| --- | --- |
| Provider | TBD |
| Region | TBD |
| OS version | TBD |
| Architecture | TBD |
| Hostname | TBD |
| Created timestamp UTC | TBD |
| Public IPv4 | private operator record |
| Public IPv6 | private operator record |
| Recovery console path | private operator record |

## Build Order

1. Provision clean OS image.
2. Patch OS packages.
3. Set hostname.
4. Configure time synchronization.
5. Create named administrative user.
6. Verify second administrative session.
7. Harden SSH.
8. Configure firewall.
9. Enable Fail2Ban or equivalent.
10. Install/reconfigure Hestia from trusted upstream packages.
11. Recreate domains through Hestia.
12. Clone source from GitHub.
13. Restore validated database and object data only.
14. Inject rotated secrets from private operator storage.
15. Run local/origin acceptance.
16. Cut over DNS only after acceptance.

## Source Repositories

Clone from GitHub:

- `modula-mod/modula-latest`
- `modula-mod/modula-module-standard`
- `modula-mod/modula-vault-notes`

Verify branch, tag, and commit before deployment.

## Initial Clean Host Gates

These must pass before application secrets are installed:

```sh
hostname -f
timedatectl status
apt list --upgradable
systemctl is-active fail2ban
sshd -T
ufw status verbose
ss -tulpn
```

Expected policy:

- public-key SSH authentication;
- no weak password authentication;
- no arbitrary root remote access if operationally avoidable;
- external exposure limited to required services;
- PostgreSQL, Redis, Docker API, internal API/worker ports, Metro, and development servers not exposed publicly.
