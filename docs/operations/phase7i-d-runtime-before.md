# Phase 7I-D Runtime Before Inventory

Captured: 2026-08-09T00:03:02Z

## Source Gate

- Canonical source: `/root/modula-latest`
- Canonical branch: `phase7i-trusted-production-alpha`
- `SOURCE_RELEASE_SHA`: `974a3b2354fedd010a884a5d342fefbc24184fe9`
- `git status --short`: clean
- `git rev-parse HEAD`: `974a3b2354fedd010a884a5d342fefbc24184fe9`
- `git rev-parse origin/phase7i-trusted-production-alpha`: `974a3b2354fedd010a884a5d342fefbc24184fe9`
- `git diff --check`: clean

External canonical repositories:

- `/root/modula-mod/modula-module-standard`: clean, `2bfc0a826d19db870a445e06d52010cec6e0a54f`
- `/root/modula-mod/modula-vault-notes`: clean, `4f2c3c9ef18a862ca4f896c3f59bf2e821b38c11`

## Active Product Routing

- `api.modula.digital` is served by `/etc/nginx/conf.d/api.modula.digital.greenfield.conf`.
- Active API upstream: `http://127.0.0.1:4020`.
- `modula.digital` and `www.modula.digital` are served by `/home/andrei/conf/web/modula.digital/nginx.ssl.conf`.
- Active web root: `/var/www/modula/current`.
- Current web symlink: `/var/www/modula/current -> /var/www/modula/releases/eb0ca524a86872e3e9a467bf5e582d06a3ce8119`.
- Current `version.json` commit: `eb0ca524a86872e3e9a467bf5e582d06a3ce8119`.
- Current `version.json` phase: `phase7e-block14`.

Current API evidence:

- `GET http://127.0.0.1:4020/v1/health/live`: `ok`, status `live`.
- `GET http://127.0.0.1:4020/v1/health/ready`: `ok`, status `ready`.
- `GET http://127.0.0.1:4020/v1/meta`: reports `environment: preview`, `inviteOnly: true`, and Greenfield module registry enabled.
- `GET http://127.0.0.1:4020/v1/stories/rail`: `404 Route GET:/v1/stories/rail not found`.

## Runtime Classifications

No `UNKNOWN` classifications remain in this inventory.

| Stack or component | Evidence | Classification | Action |
| --- | --- | --- | --- |
| `modula-preview` Compose stack | `docker compose ls` shows running stack from `/home/andrei/modula-latest/ops/docker/compose.preview.yml` | `REPLACE` | Replace with production topology sourced from `/root/modula-latest`; do not use preview compose as production. |
| `modula-preview-greenfield-api-1` | Image `modula-preview-greenfield-api`, running healthy, `127.0.0.1:4020->4020`, UID `999(modula)` | `REPLACE` | Stop during maintenance, dump final DB, then replace with immutable production API image. |
| `modula-preview-greenfield-worker-1` | Image `modula-preview-greenfield-worker`, running, UID `999(modula)` | `REPLACE` | Stop during maintenance before final dump; replace with immutable production Worker image. |
| `modula-preview-greenfield-postgres-1` | `postgres:16.9-alpine`, running healthy, `127.0.0.1:5433->5432`, volume `modula-preview_modula_pg_data` | `REPLACE` | Use logical dump only; rebuild fresh PostgreSQL runtime and quarantine old volume after acceptance. |
| Greenfield Redis | No running container and no host `redis-server`; historical Redis volumes exist for other stacks | `REPLACE` | Build fresh private Redis runtime; do not import historical Redis state. |
| `/var/lib/modula/greenfield-media` | Mounted into preview API | `KEEP` | Preserve media directory during API/runtime replacement. |
| Nginx | `nginx.service` active, public ports `80/443`, API upstream points to preview API | `KEEP` | Back up and update only controlled domain configs during cutover. |
| Hestia | `hestia.service` active on `8083`; generated Hestia configs present | `KEEP` | Preserve panel and generated configs; avoid blind template rewrites. |
| Apache | `apache2` inactive; Hestia generated Apache configs remain | `KEEP` | Do not start for Modula cutover unless explicitly required. |
| Exim | `exim4.service` active on `25`, queue count `1` | `KEEP` | Repair mailbox routing, DKIM, SPF, DMARC, relay, and observability in D2. |
| Dovecot | `dovecot.service` active on `110/143/993/995` | `KEEP` | Keep for mailboxes after routing repair. |
| MariaDB | `mariadb.service` active on `127.0.0.1:3306`; Exim mailbox router reads `andrei_modula_core.modula_mailboxes` | `KEEP` | Keep as mail control-plane dependency unless mail architecture changes. |
| BIND/named | `named.service` active on DNS port `53` | `KEEP` | Keep local zone data; Cloudflare remains public authority for current answers. |
| `open-webui` container | Image `modula-backend:production`, exited 137, not listening | `QUARANTINE` | Retain for provenance; must not answer Modula product domains. |
| `modula-keycloak-db` container | `postgres:15-alpine`, exited, `modula-sso` network empty | `QUARANTINE` | Retain for provenance until SSO/keycloak status is explicitly retired. |
| `modula-sso_keycloak-network` | Empty Docker network | `QUARANTINE` | Keep until old SSO artifacts are reviewed. |
| `open-webui-frontend_default` network and Open WebUI volumes | Empty network, old Open WebUI volumes | `QUARANTINE` | Must not be product-domain fallback. |
| `runtime_default` network | Empty compose network | `QUARANTINE` | Retain until owner reviewed; no active container. |
| `appmoduladigital_*` volumes | Compose labels for `appmoduladigital`, no active containers | `QUARANTINE` | Historical app data; do not use for Greenfield cutover. |
| Anonymous Docker volumes | Six unattached anonymous volumes | `QUARANTINE` | Orphan volumes; retain until retention review, do not mount into new runtime. |
| `dimon-exchange_*` volumes | Compose labels for `dimon-exchange`, no active containers | `UNRELATED` | Not part of Greenfield recovery; preserve. |
| `gaia-mit_*` volumes | Compose labels for `gaia-mit`, no active containers | `UNRELATED` | Not part of Greenfield recovery; preserve. |
| `librechat_pgdata2` volume | Compose label for `librechat`, no active containers | `UNRELATED` | Not part of Greenfield recovery; preserve and isolate. |
| `monitoring_*` volumes | Compose labels for `monitoring`, no active containers | `KEEP` | Available for observability recovery if reused; no active monitoring container now. |
| `root_n8n_data` volume | Compose label for root/n8n, no active containers | `UNRELATED` | Preserve. |
| `uninbox-local-dev_*` volumes | Compose labels for `uninbox-local-dev`, no active containers | `QUARANTINE` | Keep disabled; previous custom mail pipes must remain disabled. |

## Listener Summary

Public listeners:

- `22/tcp`, `2222/tcp`: SSH
- `25/tcp`: Exim SMTP
- `53/tcp`, `53/udp`: BIND/named
- `80/tcp`, `443/tcp`: Nginx
- `110/tcp`, `143/tcp`, `993/tcp`, `995/tcp`: Dovecot
- `8083/tcp`: Hestia panel

Local/private listeners:

- `127.0.0.1:3306`: MariaDB
- `127.0.0.1:4020`: preview Greenfield API
- `127.0.0.1:5433`: preview PostgreSQL container port
- `127.0.0.1:8084`: Nginx status
- `127.0.0.1:953`: named control

No public PostgreSQL `5432/5433`, Redis `6379`, Docker daemon, Metro, Expo, Vite, or Node debug port was observed in the listener summary.

## Production Database Before State

- Source runtime: `modula-preview-greenfield-postgres-1`
- PostgreSQL version: `PostgreSQL 16.9 on x86_64-pc-linux-musl`
- Database: `modula`
- Admin user used for inventory: `modula_admin`
- Applied migrations stop at `021_phase7e_unified_search.sql`.
- Source contains migrations through `029_phase7h_mail.sql`; pending production migrations start at `022_phase7e_module_records_and_vault_notes.sql`.

Representative counts before maintenance:

| Table | Count |
| --- | ---: |
| `greenfield_accounts` | 88 |
| `profiles` | 92 |
| `posts` | 81 |
| `greenfield_comments` | 21 |
| `greenfield_reactions` | 7 |
| `follows` | 19 |
| `notifications` | 40 |
| `greenfield_module_sources` | 5 |
| `greenfield_module_releases` | 5 |
| `greenfield_extension_installations` | 14 |
| `greenfield_module_records` | 9 |
| `audit_events` | 487 |
| `background_jobs` | 323 |
| `post_likes` | 4 |
| `post_reposts` | 6 |
| `post_saves` | 5 |
| `greenfield_quote_posts` | 3 |
| `greenfield_mentions` | 1 |
| `blocks` | 0 |
| `mutes` | 0 |
| `reports` | 0 |

Missing current-source tables in live DB:

- `greenfield_story_groups`
- `greenfield_story_items`
- `greenfield_story_views`
- `greenfield_mail_jobs`
- later module backend/runtime tables introduced after migration `021`

## Mail Before State

- Exim queue count: `1`.
- Active virtual mailbox router reads `andrei_modula_core.modula_mailboxes`.
- Active mailbox table has many test/personal rows, but not the required production addresses.
- `exim -bt hello@modula.digital`: undeliverable.
- `exim -bt support@modula.digital`: undeliverable.
- `exim -bt security@modula.digital`: routed through `root@core.modula.digital` to `/var/mail/mail`, not a dedicated mailbox.
- No public DKIM TXT was found for `mail._domainkey`, `default._domainkey`, or `dkim._domainkey`.

Public DNS before state from `@1.1.1.1`:

- `modula.digital MX`: `0 _dc-mx.7bcf480fc4de.modula.digital.`
- `mail.modula.digital A`: Cloudflare proxy IPs `104.21.27.33`, `172.67.168.220`
- `mail.modula.digital AAAA`: Cloudflare proxy IPs `2606:4700:3034::ac43:a8dc`, `2606:4700:3036::6815:1b21`
- SPF TXT records: duplicate records present
- DMARC TXT records: duplicate records present

Local Hestia zone before state has direct mail records, but public Cloudflare answers do not match it.

## Cutover Implications

- The current live product is stale: web release is `phase7e-block14`, API reports `preview`, and Stories rail is absent.
- Production data must be frozen, logically dumped, restored into a disposable PostgreSQL 16 runtime, migrated through `029`, and verified before replacing the real runtime.
- Mail cannot be considered operational until Greenfield uses `greenfield_mail_jobs`, Worker delivery, a real relay, valid mailbox routing, and non-duplicated SPF/DKIM/DMARC.
- Backend Service Fabric work must not start until the production database/runtime replacement gate passes.
