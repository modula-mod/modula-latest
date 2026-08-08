# Phase 7E Block 14 Web Production Cutover

Status: complete for frontend cutover

Date: 2026-08-02
Canonical host: `https://modula.digital`
Production frontend model: static Expo Router web export served by Nginx/Hestia
Production Greenfield deployment: not performed
Production database migration: not performed

## Build and Artifact

Build command:

```bash
pnpm build:web
pnpm verify:web-build
```

The production build uses:

- `EXPO_PUBLIC_APP_ENV=production`
- `EXPO_PUBLIC_DATA_SOURCE=remote`
- `EXPO_PUBLIC_API_URL=https://api.modula.digital`

Artifact path before deployment: `/home/andrei/modula-latest/dist`

Active deployed release at cutover verification:

- release directory: `/var/www/modula/releases/eb0ca524a86872e3e9a467bf5e582d06a3ce8119`
- current symlink: `/var/www/modula/current -> releases/eb0ca524a86872e3e9a467bf5e582d06a3ce8119`
- previous symlink: `/var/www/modula/previous -> releases/8a06f3890fb89914409edbbbde716ae3b82ce506`
- version marker: `/var/www/modula/current/version.json`

The report/evidence commit is published after this cutover record and the final
production deployment must be verified by `version.json` and
`pnpm verify:phase7e-web-production-cutover`.

## Routing

Root cause of old OpenWebUI exposure:

- Hestia domain `modula.digital` used proxy template `openwebui`.
- The generated vhost proxied apex and `www` to `http://127.0.0.1:3000`.
- Docker published the OpenWebUI container as `0.0.0.0:3000->8080/tcp`.

New durable Hestia template:

- `/usr/local/hestia/data/templates/web/nginx/modula-static.tpl`
- `/usr/local/hestia/data/templates/web/nginx/modula-static.stpl`

Hestia domain state after cutover:

- user: `andrei`
- domain: `modula.digital`
- alias: `www.modula.digital`
- proxy template: `modula-static`
- root: `/var/www/modula/current`
- HSTS: not enabled during Block 14

Nginx behavior:

- `http://modula.digital` redirects to `https://modula.digital`
- `https://www.modula.digital` redirects to `https://modula.digital`
- `https://modula.digital` serves the Modula static app
- SPA fallback uses `try_files $uri $uri/ /index.html`
- no `proxy_pass` to OpenWebUI exists in the Modula vhost

## OpenWebUI Preservation

OpenWebUI was not deleted or stopped.

Preservation artifacts:

- `/var/backups/modula/openwebui-inspect-20260801T222601Z.json`
- `/var/backups/modula/openwebui-volumes-20260801T222601Z/`
- `/var/backups/modula/openwebui-volumes-20260801T222601Z/checksums.sha256`

The `open-webui` Docker container remains healthy. A persistent firewall rule
was added through:

- `/usr/local/sbin/modula-openwebui-firewall.sh`
- `/etc/systemd/system/modula-openwebui-firewall.service`

Verified active rule:

```bash
iptables -S DOCKER-USER
ip6tables -S DOCKER-USER
```

Observed rules:

- IPv4: `-A DOCKER-USER -i ens6 -p tcp -m conntrack --ctorigdstport 3000 -j DROP`
- IPv6: `-A DOCKER-USER -i ens6 -p tcp -m tcp --dport 3000 -j DROP`

## Verification

Passed checks:

| Command | Result |
| --- | --- |
| `nginx -t` | passed before and after Hestia template change |
| `systemctl reload nginx` | passed |
| `curl -fsS https://modula.digital/ >/tmp/modula-home.html` | passed |
| `grep -qi 'Open WebUI' /tmp/modula-home.html` | absent |
| `curl -fsS https://modula.digital/version.json` | returned Modula marker |
| `curl -sSI https://www.modula.digital/` | returned `301` to apex |
| `pnpm verify:web-build` | passed |
| `pnpm verify:phase7e-web-production-cutover` | passed |

TLS:

- subject: `CN = modula.digital`
- issuer: `Google Trust Services WE1`
- valid from: `Jun 15 14:20:12 2026 GMT`
- valid to: `Sep 13 15:16:14 2026 GMT`

## Native Status

Phase 7F Mac/iOS acceptance has not been executed.
No native iOS acceptance result is claimed.
