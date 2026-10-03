# Live Production Probe Results

Captured: 2026-10-03T10:05:40.701Z
Policy: anonymous and non-mutating except a schema-invalid registration request that cannot persist
Result: 26/26 requests passed; 17 unique route templates exercised.

No bearer token, cookie or real account was used. The only POST was an empty registration body that failed schema validation with 400 and could not persist. No production cleanup was required.

## Requests

| Method/route | Status | Latency ms | Content type | Request ID | Assertion | Result |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /version.json` | 200 | 102.3 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/health/live` | 200 | 39.8 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/health/live` | 200 | 20.8 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/health/live` | 200 | 23.5 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/health/ready` | 200 | 39.9 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/status` | 200 | 33.6 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/status` | 200 | 21.3 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/status` | 200 | 22.6 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/meta` | 200 | 30.2 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules` | 200 | 41.7 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules` | 200 | 36.6 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules` | 200 | 35.7 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules/:moduleId` | 200 | 40.5 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules/:moduleId/versions` | 200 | 27.8 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules/:moduleId/versions/:version` | 200 | 27.2 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/releases/:releaseId/artifact` | 200 | 46 | application/gzip | yes | response SHA-256 matches published release digest | PASS |
| `GET /v1/registry/releases/:releaseId/assets/:assetId` | 200 | 60.8 | image/png | yes | asset is available and SHA-256 matches metadata | PASS |
| `GET /v1/registry/modules/:moduleId` | 200 | 29.5 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/releases/:releaseId/assets/:assetId` | 404 | 26.9 | application/json; charset=utf-8 | yes | metadata declares unavailable and delivery returns 404 | PASS |
| `GET /v1/registry/modules/:moduleId` | 404 | 26.1 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/profiles/:handle` | 404 | 22.5 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/accounts/me` | 401 | 20.9 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/modules/installed` | 401 | 19.9 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/intelligence/missions` | 401 | 21.7 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/support/cases` | 401 | 17.3 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `POST /v1/accounts/register` | 400 | 21.7 | application/json; charset=utf-8 | yes | status/shape | PASS |

## Lightweight latency snapshot

Three normal serial requests were used for representative endpoints; this was not a load test.

| Path | Samples | Median ms | Max ms |
| --- | --- | --- | --- |
| /v1/health/live | 3 | 23.5 | 39.8 |
| /v1/status | 3 | 22.6 | 33.6 |
| /v1/registry/modules | 3 | 36.6 | 41.7 |

No multi-second response was observed. Source review nevertheless identifies unbounded/N+1 activity hydration as a growth risk.

## What was verified

- Public version, live, ready, status, meta and module catalogue/detail/version endpoints traverse DNS/TLS/nginx.
- A real release package and artwork object were retrieved and SHA-256 matched their metadata.
- Declared unavailable artwork returned 404; unknown module/profile resources returned 404.
- Account, installed-modules, intelligence and support reads rejected anonymous access with 401.
- Representative malformed registration input returned 400.

## Explicitly not executed

- Authorized read/write, ownership rejection, module-record isolation and mission isolation were not live-probed because no dedicated production audit identities and cleanup-capable harness were available.
- Install/uninstall, follow, reactions, posting, upload and intelligence execution were statically/integration verified only.
- This limitation is why the mission status is PARTIAL rather than PASS.
