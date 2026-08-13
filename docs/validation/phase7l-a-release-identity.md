# Phase 7L-A Release Identity

Date: 2026-08-13
Repo: `/root/modula-latest`
Branch under audit: `main`

## Commands run

```sh
git -C /root/modula-latest fetch origin --prune --tags
git -C /root/modula-latest status --short
git -C /root/modula-latest rev-parse HEAD
git -C /root/modula-latest rev-parse origin/main
git -C /root/modula-latest describe --tags --always
git -C /root/modula-latest rev-parse modula-beta-foundation-2026-08
curl -fsS https://modula.digital/version.json
curl -fsS https://api.modula.digital/version.json
```

## Source truth

| Field | Value |
| --- | --- |
| `MAIN_SHA` | `fb4b58c07bf475d99ab6792d367058331257ea97` |
| `origin/main` | `fb4b58c07bf475d99ab6792d367058331257ea97` |
| `git describe` | `modula-beta-foundation-2026-08-4-gfb4b58c` |
| `BETA_TAG_SHA` | `2ef3755082b46e49fe62424e93d4a4de9c6f1e17` |
| Dirty state before Phase 7L-A docs | `?? docs/validation/evidence/phase7l-a/` |

## Production truth

| Surface | Reported commit | Built at | Extra |
| --- | --- | --- | --- |
| `https://modula.digital/version.json` | `2ef3755082b46e49fe62424e93d4a4de9c6f1e17` | `2026-08-13T14:43:14.159Z` | `phase7e-block14`, `dataSource=remote`, `apiOrigin=https://api.modula.digital` |
| `https://api.modula.digital/version.json` | `2ef3755082b46e49fe62424e93d4a4de9c6f1e17` | `2026-08-13T14:42:26Z` | `phase7i-f5b`; worker expected commit also `2ef3755082b46e49fe62424e93d4a4de9c6f1e17` |
| Worker | `2ef3755082b46e49fe62424e93d4a4de9c6f1e17` | Reported by API version envelope | Expected commit only; live worker process health is audited separately |
| Mail provisioner | `2ef3755082b46e49fe62424e93d4a4de9c6f1e17` | Reported by API version envelope | `mode=disabled` |

## Classification

| Item | Status | Priority | Evidence |
| --- | --- | --- | --- |
| Source baseline | WORKING | P0 | Local `main` equals `origin/main` at `fb4b58c07bf475d99ab6792d367058331257ea97`. |
| Production identity | WORKING_WITH_DEFECTS | P0 | Production web/API remain pinned to `2ef3755082b46e49fe62424e93d4a4de9c6f1e17`, not current `main`. This is intentional beta pinning, but must not be confused with source truth. |
| Worker identity | WORKING_WITH_DEFECTS | P1 | API reports expected worker commit only; process-level worker health still needs direct host/service evidence. |
| Mail provisioner identity | INTERNAL_ONLY | P1 | API reports mail provisioner expected commit but `mode=disabled`; user-facing mail provisioning must not imply automatic production mailbox creation. |

## Audit conclusion

Production is not running current `main`. Production web and API both report the accepted beta foundation SHA `2ef3755082b46e49fe62424e93d4a4de9c6f1e17`. Current source is four commits ahead at `fb4b58c07bf475d99ab6792d367058331257ea97`.
