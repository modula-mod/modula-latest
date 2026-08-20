# Modula Web Deployment and Rollback

Date: 2026-08-01
Production domain: `https://modula.digital`
Canonical host: apex
Production model: static Expo Router web export served by Nginx through Hestia

## Build

The production web build is:

```bash
pnpm build:web
pnpm verify:web-build
```

`pnpm build:web` runs Expo static export with:

- `EXPO_PUBLIC_APP_ENV=production`
- `EXPO_PUBLIC_DATA_SOURCE=remote`
- `EXPO_PUBLIC_API_URL=https://api.modula.digital`

The build writes:

- `dist/index.html`
- `dist/_expo/`
- `dist/version.json`
- `dist/release.json`
- `dist/checksums.sha256`

`version.json` is non-secret and records only the app name, package version,
Phase 7E Block 14 marker, Git commit, branch, build timestamp, environment,
data source, and public API origin.

## Release Layout

Production releases use atomic symlinks:

```text
/var/www/modula/
  releases/
    <commit-sha>/
  current -> releases/<current-sha>
  previous -> releases/<previous-sha>
```

The active Nginx document root is `/var/www/modula/current`.

At least two previous release directories should be retained. Rollback must not
depend on rebuilding the app.

## Deploy Procedure

Deploy only a clean, tested commit from `main`.

```bash
cd /home/andrei/modula-latest
git switch main
git pull --ff-only
git status --short
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm verify:phase7e-no-product-mocks
pnpm build:web
pnpm verify:web-build
```

Create a new release directory:

```bash
COMMIT="$(git rev-parse HEAD)"
RELEASE="/var/www/modula/releases/${COMMIT}"
mkdir -p /var/www/modula/releases
test ! -e "${RELEASE}"
cp -a dist/. "${RELEASE}/"
find "${RELEASE}" -type d -exec chmod 755 {} +
find "${RELEASE}" -type f -exec chmod 644 {} +
cd "${RELEASE}"
sha256sum -c checksums.sha256
```

Switch atomically:

```bash
cd /var/www/modula
if [ -L current ]; then PREVIOUS_TARGET="$(readlink -f current)"; ln -sfn "${PREVIOUS_TARGET}" previous; fi
ln -sfn "releases/${COMMIT}" current
nginx -t
systemctl reload nginx
```

Smoke test:

```bash
curl -fsS https://modula.digital/version.json
curl -fsS https://modula.digital/ >/tmp/modula-home.html
grep -qi 'Open WebUI' /tmp/modula-home.html && exit 1
curl -fsSI https://www.modula.digital/
```

## Rollback

Rollback does not rebuild the app.

```bash
cd /var/www/modula
test -L previous
ROLLBACK_TARGET="$(readlink -f previous)"
CURRENT_TARGET="$(readlink -f current)"
ln -sfn "${CURRENT_TARGET}" rollback-from
ln -sfn "${ROLLBACK_TARGET}" current
nginx -t
systemctl reload nginx
curl -fsS https://modula.digital/version.json
curl -fsS https://modula.digital/ >/tmp/modula-home-rollback.html
grep -qi 'Open WebUI' /tmp/modula-home-rollback.html && exit 1
```

If rollback passes, `rollback-from` can be kept as provenance until the next
successful deployment.

## Hestia/Nginx Model

Use a persistent Hestia Nginx proxy template for Modula static hosting. Do not
edit generated domain files directly except for inspection or emergency
rollback, because Hestia can regenerate them.

Required vhost behavior:

- HTTP redirects to `https://modula.digital`.
- `https://www.modula.digital` redirects to `https://modula.digital`.
- Apex serves `/var/www/modula/current`.
- Route fallback uses `try_files $uri $uri.html $uri/index.html @expo_dynamic`.
- `@expo_dynamic` rewrites Expo `[param]` templates only after exact HTML lookup misses, so `/profile/:handle` does not hydrate Home.
- Unmatched paths resolve to Expo's exported `+not-found.html`, never Home's `index.html`, preventing a 404 hydration mismatch.
- Hashed Expo assets receive long immutable caching.
- `index.html`, `version.json`, and `release.json` are no-cache.
- Dotfiles and source environment files are denied.
- There is no proxy to OpenWebUI.
- HSTS remains disabled until both apex and www are verified.

## OpenWebUI Port Guard

OpenWebUI is preserved, but raw public access to its Docker-published port is
blocked outside the Modula vhost path.

Persistent guard:

```bash
systemctl status modula-openwebui-firewall.service
iptables -S DOCKER-USER
ip6tables -S DOCKER-USER
```

Expected rules:

```text
-A DOCKER-USER -i ens6 -p tcp -m conntrack --ctorigdstport 3000 -j DROP
-A DOCKER-USER -i ens6 -p tcp -m tcp --dport 3000 -j DROP
```

Do not remove the `open-webui` container, volumes, database, configuration or
model links as part of a web rollback. Rollback only changes
`/var/www/modula/current` and reloads Nginx.

## Native Status

Phase 7F Mac/iOS acceptance has not been executed.
No native iOS acceptance result is claimed.
