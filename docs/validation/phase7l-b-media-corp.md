# Phase 7L-B Media CORP Evidence

Date: 2026-08-13
Repo: `/root/modula-latest`
Branch: `main`
Status: `PASS_LOCAL`

## Live Baseline

Command:

```sh
curl -fsSI https://api.modula.digital/v1/media/3a058370-a6fe-43ef-b318-e0579599cfa0.png
```

Observed production headers before source repair deployment:

```text
HTTP/2 200
content-type: image/png
content-length: 68
cross-origin-resource-policy: same-origin
```

Command:

```sh
curl -fsSI -H 'Origin: https://modula.digital' https://api.modula.digital/v1/media/3a058370-a6fe-43ef-b318-e0579599cfa0.png
```

Observed production headers before source repair deployment:

```text
access-control-allow-origin: https://modula.digital
cross-origin-resource-policy: same-origin
```

Conclusion: production CORS already permits the canonical web origin, but Helmet's default `CORP: same-origin` blocks `https://modula.digital` from embedding media served by `https://api.modula.digital`.

## Security Contract

Browser-visible media stays on canonical HTTPS API URLs under `https://api.modula.digital/v1/media/...`.

The least-broad CORP policy for the current architecture is `same-site`, not `cross-origin`, because `modula.digital` and `api.modula.digital` share the same registrable site.

This source repair does not make private media public. Existing route authorization remains before file bytes are sent:

- post media: non-public post media still requires the author account.
- Story media: followers/private visibility still passes through Story visibility checks.
- CORS remains origin-list based; wildcard origins are still refused by configuration.

## Source Changes

- `services/greenfield-api/src/app/media-response.ts`
  - adds one route-scoped helper for browser-visible media headers.
- `services/greenfield-api/src/app/register-routes.ts`
  - uses the helper for `/v1/media/:mediaFile` success responses.
- `services/greenfield-api/src/app/register-phase7f-stories-routes.ts`
  - uses the helper for `/v1/media/stories/:mediaFile` success responses.
- `services/greenfield-api/tests/phase7l.media-headers.test.ts`
  - verifies Helmet's default same-origin CORP is overridden only for browser-visible media responses and CORS remains origin-list based.
- `services/greenfield-api/tests/phase6s.social.test.ts`
  - adds DB-backed post media header assertions for the disposable DB acceptance run.
- `services/greenfield-api/tests/phase7i.f5-stories.test.ts`
  - adds DB-backed Story media header assertions for the disposable DB acceptance run.

## Verification

Command:

```sh
pnpm --filter @modula/greenfield-api exec vitest run tests/phase7l.media-headers.test.ts tests/phase7c.media-storage.test.ts
```

Result:

```text
Test Files  2 passed (2)
Tests       4 passed (4)
```

Command:

```sh
pnpm --filter @modula/greenfield-api typecheck
```

Result:

```text
tsc -p tsconfig.json --noEmit
```

Command:

```sh
git diff --check
```

Result: no whitespace errors.

## Remaining Boundaries

- Live production still shows `Cross-Origin-Resource-Policy: same-origin` until this source repair is deployed.
- Disposable DB acceptance has not been configured in this slice, so the DB-backed social and Story media header assertions were not run here.
- Browser-visible avatar, image-post, Story, and marketplace media rendering still require authenticated browser proof after deployment.
