# Phase 7L-B live public golden path

Date: 2026-08-15  
Accepted production SHA: `e5d4b946fdf80fb82f0ae0963bdd3a087ff5e97a`  
Public web: `https://modula.digital`  
Public API: `https://api.modula.digital`  
Evidence: `docs/validation/evidence/phase7l-b-live/`

This is the production-identity close for Phase 7L-B. Simulator golden-path evidence remains in `docs/validation/phase7l-b-simulator-golden-path.md`. Documentation commits after this SHA do not change the running release; live identity stays `e5d4b94` until a later exact-SHA redeploy.

## Identity agreement

| Surface | Commit |
| --- | --- |
| Git candidate at cutover | `e5d4b946fdf80fb82f0ae0963bdd3a087ff5e97a` |
| Web `/version.json` | same |
| API `/version.json` | same |
| Worker `expectedCommit` | same |
| Docker `modula-greenfield-api` image + `org.opencontainers.image.revision` | same |
| Docker `modula-greenfield-worker` image + `org.opencontainers.image.revision` | same |
| API `MODULA_RELEASE_SHA` | same |
| Web release dir | `/var/www/modula/releases/e5d4b946fdf80fb82f0ae0963bdd3a087ff5e97a` |
| Previous web release preserved | `/var/www/modula/releases/2ef3755082b46e49fe62424e93d4a4de9c6f1e17` |

API `builtAt`: `2026-08-15T16:20:00Z`  
Web `builtAt`: `2026-08-15T16:21:46.763Z`  
Web `environment`: `production`  
Web `apiOrigin`: `https://api.modula.digital`

Health: `/v1/health/live` 200, `/v1/health/ready` 200.  
Postgres was not recreated. Latest migration remains `037_phase7i_f5b_rollback_compatibility`. Pre-cutover backup: `/var/backups/modula/greenfield/20260815T161228Z/`.

## Nginx Expo dynamic HTML

Live vhost and Hestia `modula-static.stpl` now use:

```nginx
try_files $uri $uri.html $uri/index.html @expo_dynamic;
```

`/sign-in` HTML does not contain Home `Create a post`.  
`/profile/:handle` HTML contains `public-profile-pending` and does not fall back to Home.

## Live path

| Step | Evidence | Result |
| --- | --- | --- |
| Public `/sign-in` | `01-sign-in.png` | 200, not Home HTML, hydration 0 |
| Direct reload `/profile/:handle` A | `02-profile-a-reload.png` | Public-profile template, not Home |
| Direct reload `/profile/:handle` B | `03-profile-b-reload.png` | Public-profile template, not Home |
| Password login → Home | `04-home-after-login.png` | `https://modula.digital/`, session bundle stored |
| Hard reload restore | `05-home-after-reload.png` | Authenticated Home, bundle still present |
| Authenticated `/profile/:handle` A | `06-authenticated-profile-a.png` | Handle visible, audience notice |
| Settings Active Sessions | `07-settings-sessions.png` | Real device rows; no “Could not load sessions.” |
| Settings Modula Mail | `08-settings-mail.png` | Honest mailbox-not-active / queued identity |
| Second-account public profile | `09-second-account-profile.png` | Visitor view for handle B |
| Browser console | `report.json` `events: []` | React `#418` = 0, pageerror = 0 |

Private APIs on the same SHA:

- `POST /v1/sessions` 200
- `GET /v1/accounts/me` 200 for handle A
- `GET /v1/accounts/me/sessions` 200, top-level array (not nested `{ok,data}` envelope)
- `GET /v1/accounts/me/modula-mail` 200
- `GET /v1/profiles/:handle` 200 for A and B

## Verdict

```text
P0 OPEN       0
P1 OPEN       0

PASS_LOCAL    PASS
PASS_LIVE     PASS
```

Phase 7L-B production acceptance is closed on SHA `e5d4b946fdf80fb82f0ae0963bdd3a087ff5e97a`.
