# Phase 7E Block 14 modula.digital Routing Diagnosis

Date: 2026-08-01
Host: VPS/Linux
Domain: modula.digital
Canonical host selected for Block 14: `https://modula.digital`

## Summary

`modula.digital` and `www.modula.digital` served OpenWebUI because Hestia had the
domain configured with the persistent proxy template `openwebui`. The generated
Nginx vhosts proxied both apex and www traffic to `http://127.0.0.1:3000`, and
Docker published the `open-webui` container on that port.

OpenWebUI data and service are preserved. The routing correction must change
only the Modula domain vhost/template and must not delete the OpenWebUI
container, volumes, database, configuration, model links, or backup data.

## DNS

Commands:

```bash
dig +short A modula.digital
dig +short AAAA modula.digital
dig +short CNAME modula.digital
dig +short A www.modula.digital
dig +short AAAA www.modula.digital
dig +short CNAME www.modula.digital
```

Observed:

- `modula.digital` A records: `104.21.27.33`, `172.67.168.220`
- `modula.digital` AAAA records: `2606:4700:3034::ac43:a8dc`, `2606:4700:3036::6815:1b21`
- `www.modula.digital` A records: `104.21.27.33`, `172.67.168.220`
- `www.modula.digital` AAAA records: `2606:4700:3034::ac43:a8dc`, `2606:4700:3036::6815:1b21`
- No CNAME response was returned for apex or www.

The public DNS is Cloudflare-fronted. No local `cloudflared` binary or running
Cloudflare tunnel service was found on the VPS during local inspection.

## Live HTTP and TLS

Commands:

```bash
curl -vkI https://modula.digital/
curl -vkI https://www.modula.digital/
curl -fsSL https://modula.digital/ | head -100
curl -fsSL https://www.modula.digital/ | head -100
curl -fsSL https://modula.digital/api/config
openssl s_client -connect modula.digital:443 -servername modula.digital </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates
```

Observed:

- Apex returned `HTTP/2 200` through Cloudflare.
- Www returned `HTTP/2 200`; it did not redirect to apex.
- The HTML shell matched OpenWebUI static structure.
- `https://modula.digital/_app/version.json` returned `{"version":"1781880891923"}`.
- `https://modula.digital/api/config` returned an OpenWebUI API payload with `"name":"Open WebUI"` and `"version":"0.5.4"`.
- Certificate subject: `CN = modula.digital`
- Certificate issuer: `Google Trust Services WE1`
- Certificate validity: `Jun 15 14:20:12 2026 GMT` to `Sep 13 15:16:14 2026 GMT`

## Running Services

Commands:

```bash
ss -ltnp
systemctl --type=service --state=running
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'
docker ps --format '{{.ID}} {{.Names}} {{.Image}} {{.Ports}}' | grep -iE 'open.?webui|webui|ollama'
```

Relevant observations:

- Nginx owns public ports 80 and 443.
- Docker publishes the OpenWebUI container on `0.0.0.0:3000->8080/tcp` and `[::]:3000->8080/tcp`.
- Container: `open-webui`, image `modula-backend:production`, status healthy.
- `socat-openwebui.service` is running and is described as `Port forward 4001 to 3000 for Open WebUI`.
- Preview Greenfield API is bound to loopback on `127.0.0.1:4020`.
- Preview PostgreSQL is bound to loopback on `127.0.0.1:5433`.

## Hestia and Nginx

Commands:

```bash
nginx -T 2>&1 | grep -n -B5 -A30 -E 'server_name .*modula\.digital|proxy_pass|open.?webui'
/usr/local/hestia/bin/v-list-users json
/usr/local/hestia/bin/v-list-web-domains andrei json
/usr/local/hestia/bin/v-list-web-domain andrei modula.digital json
```

Observed Hestia domain state:

- User: `andrei`
- Domain: `modula.digital`
- Alias: `www.modula.digital`
- Document root: `/home/andrei/web/modula.digital/public_html/`
- SSL: enabled
- SSL force: enabled
- Let's Encrypt: enabled
- Nginx template: `default`
- Proxy template: `openwebui`

Generated Nginx vhosts:

- `/home/andrei/conf/web/modula.digital/nginx.conf`
- `/home/andrei/conf/web/modula.digital/nginx.ssl.conf`
- `/etc/nginx/conf.d/domains/modula.digital.conf`
- `/etc/nginx/conf.d/domains/modula.digital.ssl.conf`

The generated domain configs proxy to `http://127.0.0.1:3000`.

Persistent Hestia proxy templates:

- `/usr/local/hestia/data/templates/web/nginx/openwebui.tpl`
- `/usr/local/hestia/data/templates/web/nginx/openwebui.stpl`

These templates route the Modula domain to OpenWebUI and explain why generated
config edits alone would not be durable.

## Document Root

`/home/andrei/web/modula.digital/public_html/` contains old OpenWebUI static
files such as `_app/`, `pyodide/`, `themes/`, `manifest.json`, and `index.html`.
Those files are not the primary live cause while the Hestia proxy template is
active, but they must not be reused as the Modula production artifact.

## Root Cause

The exact root cause is:

1. Hestia domain `modula.digital` has `PROXY=openwebui`.
2. The `openwebui` Hestia Nginx proxy template sends apex and www to `127.0.0.1:3000`.
3. Docker publishes the `open-webui` container on port 3000.
4. The www alias is attached to the same Hestia domain and currently does not
   perform a canonical redirect.

## OpenWebUI Preservation

Preservation artifacts created before routing changes:

- Container inspect backup:
  `/var/backups/modula/openwebui-inspect-20260801T222601Z.json`
- Volume backup directory:
  `/var/backups/modula/openwebui-volumes-20260801T222601Z/`
- Checksum manifest:
  `/var/backups/modula/openwebui-volumes-20260801T222601Z/checksums.sha256`

Preserved mounts:

- Docker volume `open-webui-frontend_open-webui` at `/app/backend/data`
- Docker volume `open-webui-frontend_open-webui-marketplace` at `/app/backend/open_webui/storage/marketplace`
- Bind mount `/home/andrei/open-webui-frontend` at `/workspace/openwebui-frontend`
- Bind mount `/var/modula/marketplace`
- Bind mount `/var/modula/package-cache`

OpenWebUI may remain running internally after the cutover, but it must not
answer for `modula.digital` or `www.modula.digital`.
