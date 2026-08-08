# Phase 7F-B — Development Authentication Environment

**Date:** 2026-08-05  
**Policy:** Non-production only. No production deploy/migrations.

## Selected environment

| Field | Value |
| --- | --- |
| Environment name | Phase 7F-B local product API (`EXPO_PUBLIC_DATA_SOURCE=local`) |
| API origin | In-process LocalApiServer (no remote origin) |
| Deployed commit | Branch tip of `phase7f-b-native-product-ui-auth-browse` |
| Migration level | Local mirror implements Stories + auth tables in memory; Greenfield SQL migration `028_phase7f_stories` is ready for a Postgres-backed Greenfield when Docker is available |
| SMTP mode | Local verification tokens returned/consumed via LocalApiDatabase (controlled mailbox) |
| Disposable data | Yes — reset via LocalApiController / app reinstall |
| Invite-only | No (registration open) |

## Why not `api.modula.digital`

Phase 7F-A used remote Greenfield preview with `inviteOnly: true`, which blocked registration and inventing valid login credentials. Docker Desktop was unavailable on this Mac during Checkpoint C, so the mutable local API is the accepted Phase 7F-B development environment.

## Credentials policy

- No passwords, tokens, or private credentials committed to Git.
- Demo auto-login remains off (`EXPO_PUBLIC_DEMO_SESSION` empty).
- Test accounts created by `scripts/seed-phase7f-b-acceptance.mjs` must be clearly marked.

## Switching back to remote preview

```bash
EXPO_PUBLIC_DATA_SOURCE=remote
EXPO_PUBLIC_API_URL=https://api.modula.digital
```

Remote remains invite-only until a mutable founder-alpha/Postgres Greenfield is provisioned.
