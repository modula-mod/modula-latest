# Phase 7I-F Firewall Reconciliation

Date: 2026-08-09
Repo: `/root/modula-latest`
Branch: `phase7i-trusted-production-alpha`
Commit: `0f9708bbaa1896e438dc3a9f5b28ec6d1327c353`

## Verdict

`PASS`

The Hestia firewall update now completes cleanly, `systemctl --failed` reports zero failed units, Fail2ban is active, and the RECIDIVE jail maps to the live `fail2ban-RECIDIVE` chain.

## Root Cause

The warning was not caused by the live iptables rule set alone. The source was corrupted persistent Hestia firewall metadata:

| File | Finding |
| --- | --- |
| `/usr/local/hestia/data/firewall/chains.conf` | binary/NUL-contaminated file with thousands of duplicate stale chain rows and corrupt fragments such as `RCHAIN=` |
| `/usr/local/hestia/data/firewall/banlist.conf` | binary/NUL-contaminated stale ban data |

Reproduction before fix:

```text
/usr/local/hestia/bin/v-update-firewall
warning: command substitution: ignored null byte in input
Invalid key value format. No closing quote for key: CHAIN
Error: Invalid object format: CHAIN='RCHAIN='RECIDIVE' PORT='1:65535' PROTOCOL='TCP'
```

The active Fail2ban jail configuration uses Hestia chain management:

```text
/etc/fail2ban/jail.local -> [recidive] action = hestia[name=RECIDIVE]
/etc/fail2ban/action.d/hestia.conf -> v-add-firewall-chain <name>
```

The expected live chain name is `fail2ban-RECIDIVE`; a raw `RECIDIVE` chain is not expected.

## Changes Made

Backups:

```text
/var/backups/modula/hestia/phase7i-f/20260809T121846Z/chains.conf.before
/var/backups/modula/hestia/phase7i-f/20260809T121846Z/banlist.conf.before
/var/backups/modula/hestia/phase7i-f/20260809T122143Z/v-delete-firewall-ban.before
```

Operational files reconciled:

```text
/usr/local/hestia/data/firewall/chains.conf
/usr/local/hestia/data/firewall/banlist.conf
/usr/local/hestia/bin/v-delete-firewall-ban
```

`chains.conf` was rebuilt to the active Hestia chain set:

```text
SSH      22,2222
MAIL     25,465,587,110,995,143,993
HESTIA   8083
WEB      80,443
RECIDIVE 1:65535
```

`banlist.conf` was rebuilt from the currently active Fail2ban state, removing stale March-era ban debris and NUL corruption.

`/usr/local/hestia/bin/v-delete-firewall-ban` was patched to bound its `fail2ban-client status` calls with `timeout 5s`, preventing Hestia delete-ban hooks from hanging during Fail2ban stop/restart.

## Verification

Commands:

```sh
/usr/local/hestia/bin/v-update-firewall
systemctl --failed --no-pager
systemctl is-active fail2ban
fail2ban-client status recidive
iptables -S fail2ban-RECIDIVE
```

Results:

```text
v-update-firewall rc=0
v-update-firewall stdout_bytes=0
v-update-firewall stderr_bytes=0
systemctl --failed -> 0 loaded units listed
systemctl is-active fail2ban -> active
recidive currently banned -> 0
iptables -S fail2ban-RECIDIVE -> -N fail2ban-RECIDIVE
```

Final note: `iptables -S RECIDIVE` still fails because Hestia/Fail2ban creates `fail2ban-RECIDIVE`, not a raw chain named `RECIDIVE`.
